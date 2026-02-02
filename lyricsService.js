/**
 * LRCLIB Integration Module
 * Fetches synced lyrics from LRCLIB API
 * Handles caching and error cases (instrumental tracks, not found)
 */

const axios = require('axios');
const logger = require('./logger');
const { parseLRC } = require('./utils');

const LRCLIB_API_BASE = 'https://lrclib.net/api';
const LRCLIB_TIMEOUT = 5000; // 5 seconds timeout

class LyricsService {
  constructor() {
    this.client = axios.create({
      baseURL: LRCLIB_API_BASE,
      timeout: LRCLIB_TIMEOUT,
    });
  }

  /**
   * Fetch synced lyrics from LRCLIB by track name and artist
   * Uses fuzzy matching for best results
   * @param {string} trackName - Song title
   * @param {string} artistName - Artist name(s)
   * @param {number} duration - Track duration in milliseconds
   * @throws {Error} If API call fails
   * @returns {Promise<Object|null>} Lyrics object with synced LRC or null if not found
   */
  async fetchLyrics(trackName, artistName, duration) {
    try {
      logger.debug('Fetching lyrics from LRCLIB', {
        track: trackName,
        artist: artistName,
      });

      // Extract first artist name if multiple are present
      const primaryArtist = artistName.split(',')[0].trim();

      const response = await this.client.get('/get', {
        params: {
          track_name: trackName,
          artist_name: primaryArtist,
          duration_ms: duration,
        },
      });

      if (!response.data) {
        logger.debug('No lyrics found on LRCLIB', {
          track: trackName,
          artist: primaryArtist,
        });
        return null;
      }

      // Check if track is instrumental
      if (response.data.instrumental) {
        logger.debug('Track is instrumental', {
          track: trackName,
        });
        return {
          instrumental: true,
          syncedLyrics: null,
          plainLyrics: null,
        };
      }

      // Return both synced and plain lyrics if available
      return {
        instrumental: false,
        syncedLyrics: response.data.syncedLyrics || null,
        plainLyrics: response.data.plainLyrics || null,
      };
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        logger.warn('LRCLIB API request timeout');
        return null;
      }

      if (error.response?.status === 404) {
        logger.debug('Lyrics not found on LRCLIB', {
          track: trackName,
          artist: artistName,
        });
        return null;
      }

      logger.warn('LRCLIB API error', {
        status: error.response?.status,
        message: error.message,
      });
      return null;
    }
  }

  /**
   * Fetch and parse synced lyrics
   * @param {string} trackName - Song title
   * @param {string} artistName - Artist name(s)
   * @param {number} duration - Track duration in milliseconds
   * @returns {Promise<Array|null>} Parsed lyrics array or null
   */
  async fetchAndParseLyrics(trackName, artistName, duration) {
    const lyricsData = await this.fetchLyrics(trackName, artistName, duration);

    if (!lyricsData || !lyricsData.syncedLyrics) {
      return null;
    }

    try {
      const parsedLyrics = parseLRC(lyricsData.syncedLyrics);
      logger.debug('Lyrics parsed successfully', {
        track: trackName,
        lineCount: parsedLyrics.length,
      });
      return parsedLyrics;
    } catch (error) {
      logger.error('Failed to parse lyrics', {
        track: trackName,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Search for lyrics with retry logic
   * Attempts both synced and plain lyrics as fallback
   * @param {string} trackName - Song title
   * @param {string} artistName - Artist name(s)
   * @param {number} duration - Track duration in milliseconds
   * @returns {Promise<Array|null>} Parsed lyrics or null
   */
  async searchLyrics(trackName, artistName, duration) {
    // First try synced lyrics
    const parsed = await this.fetchAndParseLyrics(trackName, artistName, duration);
    if (parsed) {
      return parsed;
    }

    // If synced not found, try plain lyrics as fallback
    try {
      const lyricsData = await this.fetchLyrics(trackName, artistName, duration);
      if (lyricsData && lyricsData.plainLyrics && !lyricsData.instrumental) {
        logger.debug('Using plain lyrics as fallback', {
          track: trackName,
        });
        // Convert plain lyrics to simple timed format (split evenly)
        return this.convertPlainToTimed(lyricsData.plainLyrics, duration);
      }
    } catch (error) {
      logger.debug('Fallback plain lyrics retrieval failed', {
        error: error.message,
      });
    }

    return null;
  }

  /**
   * Convert plain lyrics to timed format by splitting evenly across track duration
   * This is a basic fallback when synced lyrics aren't available
   * @param {string} plainLyrics - Plain lyrics text
   * @param {number} duration - Track duration in milliseconds
   * @returns {Array} Simple timed lyrics array
   */
  convertPlainToTimed(plainLyrics, duration) {
    const lines = plainLyrics
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return [];

    const timePerLine = duration / lines.length;
    return lines.map((lyric, index) => ({
      time: Math.round(index * timePerLine),
      lyric,
    }));
  }
}

module.exports = LyricsService;
