/**
 * Main Bot Orchestrator
 * Coordinates Spotify polling, lyrics fetching, and Discord status updates
 * Implements polling loop with diff-checking and rate limiting
 */

require('dotenv').config();
const logger = require('./logger');
const SpotifyService = require('./spotifyService');
const LyricsService = require('./lyricsService');
const DiscordService = require('./discordService');
const { getLyricAtProgress, truncateLyric, LyricsCache, RateLimiter, DiffChecker } = require(
  './utils'
);

// Configuration from environment
const CONFIG = {
  DISCORD_USER_TOKEN: process.env.DISCORD_USER_TOKEN,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN: process.env.SPOTIFY_REFRESH_TOKEN,
  POLLING_INTERVAL: parseInt(process.env.POLLING_INTERVAL || '3500', 10),
  CACHE_ENABLED: process.env.CACHE_ENABLED !== 'false',
  RATE_LIMIT_THRESHOLD: parseInt(process.env.RATE_LIMIT_THRESHOLD || '1000', 10),
  SYNC_OFFSET: parseInt(process.env.SYNC_OFFSET || '0', 10),
};

// Validate required configuration
function validateConfig() {
  const required = [
    'DISCORD_USER_TOKEN',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_REFRESH_TOKEN',
  ];

  for (const key of required) {
    if (!CONFIG[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  logger.info('Configuration validated');
}

/**
 * Main bot orchestrator class
 */
class SpotifyDiscordBot {
  constructor() {
    this.spotify = new SpotifyService(
      CONFIG.SPOTIFY_CLIENT_ID,
      CONFIG.SPOTIFY_CLIENT_SECRET,
      CONFIG.SPOTIFY_REFRESH_TOKEN
    );
    this.lyrics = new LyricsService();
    this.discord = new DiscordService(CONFIG.DISCORD_USER_TOKEN);

    this.lyricsCache = new LyricsCache();
    this.rateLimiter = new RateLimiter(CONFIG.RATE_LIMIT_THRESHOLD);
    this.diffChecker = new DiffChecker();

    this.currentTrackId = null;
    this.currentLyrics = null;
    this.pollingActive = false;
    this.pollingInterval = null;
  }

  /**
   * Initialize bot: login to Discord and start polling
   */
  async initialize() {
    try {
      logger.info('Initializing Spotify Discord Lyrics Bot');
      validateConfig();

      // Start polling loop (no Discord login needed for user token)
      await this.startPolling();

      logger.info('Bot initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize bot', {
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Start the polling loop
   */
  async startPolling() {
    if (this.pollingActive) {
      logger.warn('Polling already active');
      return;
    }

    this.pollingActive = true;
    logger.info('Starting polling loop', {
      interval: CONFIG.POLLING_INTERVAL,
    });

    // Initial poll immediately
    await this.poll();

    // Then poll at regular intervals
    this.pollingInterval = setInterval(() => {
      this.poll();
    }, CONFIG.POLLING_INTERVAL);
  }

  /**
   * Single polling cycle
   */
  async poll() {
    try {
      if (!this.discord.isReady()) {
        logger.debug('Discord bot not ready yet');
        return;
      }

      // Fetch currently playing track
      const track = await this.spotify.getCurrentlyPlaying();

      if (!track) {
        // No active playback
        if (this.currentTrackId !== null) {
          await this.discord.clearStatus();
          this.currentTrackId = null;
          this.currentLyrics = null;
          this.diffChecker.reset();
          logger.info('Playback stopped');
        }
        return;
      }

      // If track changed, reset lyrics cache for this track
      if (track.id !== this.currentTrackId) {
        this.currentTrackId = track.id;
        this.currentLyrics = null;
        this.diffChecker.reset();
        logger.info('Track changed', {
          track: track.name,
          artist: track.artists,
        });

        // Fetch lyrics for new track
        await this.fetchAndCacheLyrics(track);
      }

      // Skip update if track is paused
      if (!track.isPlaying) {
        logger.debug('Track is paused');
        return;
      }

      // Get current lyric line (with sync offset for network delay)
      const progressWithOffset = track.progress + CONFIG.SYNC_OFFSET;
      const currentLyric = this.getCurrentLyric(progressWithOffset);

      // Prepare status text
      let statusText;
      if (currentLyric) {
        statusText = truncateLyric(currentLyric, '♪ ');
      } else if (this.currentLyrics && this.currentLyrics.length > 0) {
        // Has lyrics but no line at current time (intro/instrumental)
        statusText = `🎵 ${track.name}`;
      } else {
        // No lyrics available at all
        statusText = `🎵 Listening to ${track.name}`;
      }

      // Check if status has changed
      if (!this.diffChecker.hasChanged(statusText)) {
        logger.debug('Status unchanged, skipping update');
        return;
      }

      // Check rate limiting
      if (!this.rateLimiter.canUpdate()) {
        logger.debug('Rate limit threshold not met');
        return;
      }

      // Update Discord status
      await this.discord.setLyricStatus(statusText);
    } catch (error) {
      logger.error('Polling cycle error', {
        message: error.message,
      });
      // Continue polling despite errors
    }
  }

  /**
   * Fetch lyrics for a track and cache them
   * @param {Object} track - Track object from Spotify
   */
  async fetchAndCacheLyrics(track) {
    try {
      // Check cache first
      if (CONFIG.CACHE_ENABLED) {
        const cached = this.lyricsCache.get(track.name, track.artists);
        if (cached) {
          this.currentLyrics = cached;
          logger.debug('Lyrics loaded from cache', {
            track: track.name,
          });
          return;
        }
      }

      logger.debug('Fetching lyrics from LRCLIB', {
        track: track.name,
      });

      const lyrics = await this.lyrics.fetchAndParseLyrics(
        track.name,
        track.artists,
        track.duration
      );

      if (lyrics) {
        this.currentLyrics = lyrics;

        // Cache lyrics if enabled
        if (CONFIG.CACHE_ENABLED) {
          this.lyricsCache.set(track.name, track.artists, lyrics);
          logger.debug('Lyrics cached', {
            track: track.name,
            lines: lyrics.length,
          });
        }
      } else {
        logger.info('No lyrics found for track', {
          track: track.name,
          artist: track.artists,
        });
        this.currentLyrics = null;
      }
    } catch (error) {
      logger.error('Failed to fetch lyrics', {
        track: track.name,
        error: error.message,
      });
      this.currentLyrics = null;
    }
  }

  /**
   * Get current lyric line based on playback progress
   * @param {number} progressMs - Current playback progress in milliseconds
   * @returns {string|null} Current lyric line or null
   */
  getCurrentLyric(progressMs) {
    if (!this.currentLyrics || this.currentLyrics.length === 0) {
      return null;
    }

    return getLyricAtProgress(this.currentLyrics, progressMs);
  }

  /**
   * Stop polling and cleanup
   */
  async shutdown() {
    logger.info('Shutting down bot');

    this.pollingActive = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    await this.discord.clearStatus();
    await this.discord.logout();

    logger.info('Bot shutdown complete');
  }
}

/**
 * Main execution
 */
async function main() {
  const bot = new SpotifyDiscordBot();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await bot.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await bot.shutdown();
    process.exit(0);
  });

  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception', {
      message: error.message,
      stack: error.stack,
    });
    await bot.shutdown();
    process.exit(1);
  });

  try {
    await bot.initialize();
  } catch (error) {
    logger.error('Failed to start bot', {
      message: error.message,
    });
    await bot.shutdown();
    process.exit(1);
  }
}

main();
