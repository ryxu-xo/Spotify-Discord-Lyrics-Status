/**
 * Utility functions for the Spotify Discord Lyrics Bot
 * Includes LRC parsing, caching, and rate limiting logic
 */

const logger = require('./logger');

/**
 * Parse LRC format string and return an array of lyric objects
 * LRC format: [mm:ss.xx]lyric text
 * @param {string} lrcString - Raw LRC format string
 * @returns {Array} Array of {time: ms, lyric: string}
 */
function parseLRC(lrcString) {
  if (!lrcString) return [];

  const lines = lrcString.split('\n');
  const lyrics = [];

  lines.forEach((line) => {
    // Match [mm:ss.xx] format
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = parseInt(match[3], 10);
      const timeMs = minutes * 60000 + seconds * 1000 + centiseconds * 10;
      const lyricText = match[4].trim();

      if (lyricText) {
        lyrics.push({
          time: timeMs,
          lyric: lyricText,
        });
      }
    }
  });

  return lyrics;
}

/**
 * Find the lyric line that matches the current playback progress
 * @param {Array} lyrics - Array of parsed lyric objects
 * @param {number} progressMs - Current playback progress in milliseconds
 * @returns {string|null} The matching lyric line or null
 */
function getLyricAtProgress(lyrics, progressMs) {
  if (!lyrics || lyrics.length === 0) return null;

  let currentLyric = null;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= progressMs) {
      currentLyric = lyrics[i].lyric;
    } else {
      break;
    }
  }

  return currentLyric;
}

/**
 * Truncate lyric text to fit Discord status character limit (128 chars)
 * @param {string} lyric - The lyric text to truncate
 * @param {string} prefix - Optional prefix (e.g., "♪ ")
 * @returns {string} Truncated lyric
 */
function truncateLyric(lyric, prefix = '') {
  const maxLength = 128 - prefix.length;
  if (lyric.length > maxLength) {
    return prefix + lyric.substring(0, maxLength - 3) + '...';
  }
  return prefix + lyric;
}

/**
 * Simple in-memory cache for lyrics
 */
class LyricsCache {
  constructor(ttl = 600000) {
    // 10 minutes default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Generate cache key from track info
   * @param {string} trackName - Track name
   * @param {string} artistName - Artist name
   * @returns {string} Cache key
   */
  generateKey(trackName, artistName) {
    return `${trackName}::${artistName}`.toLowerCase();
  }

  /**
   * Set cache entry
   * @param {string} trackName - Track name
   * @param {string} artistName - Artist name
   * @param {Array} lyrics - Parsed lyrics array
   */
  set(trackName, artistName, lyrics) {
    const key = this.generateKey(trackName, artistName);
    this.cache.set(key, {
      lyrics,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cache entry if valid
   * @param {string} trackName - Track name
   * @param {string} artistName - Artist name
   * @returns {Array|null} Cached lyrics or null if expired
   */
  get(trackName, artistName) {
    const key = this.generateKey(trackName, artistName);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if cache expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.lyrics;
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number} Number of cached items
   */
  size() {
    return this.cache.size;
  }
}

/**
 * Rate limiter to prevent excessive Discord status updates
 */
class RateLimiter {
  constructor(threshold = 1000) {
    // Minimum ms between updates
    this.threshold = threshold;
    this.lastUpdate = 0;
  }

  /**
   * Check if update is allowed
   * @returns {boolean} True if enough time has passed since last update
   */
  canUpdate() {
    const now = Date.now();
    if (now - this.lastUpdate >= this.threshold) {
      this.lastUpdate = now;
      return true;
    }
    return false;
  }

  /**
   * Reset rate limiter
   */
  reset() {
    this.lastUpdate = 0;
  }
}

/**
 * Diff checker to ensure lyric has actually changed
 */
class DiffChecker {
  constructor() {
    this.lastLyric = null;
  }

  /**
   * Check if lyric has changed from last check
   * @param {string} lyric - Current lyric
   * @returns {boolean} True if lyric is different
   */
  hasChanged(lyric) {
    const changed = lyric !== this.lastLyric;
    if (changed) {
      this.lastLyric = lyric;
    }
    return changed;
  }

  /**
   * Reset diff checker
   */
  reset() {
    this.lastLyric = null;
  }
}

module.exports = {
  parseLRC,
  getLyricAtProgress,
  truncateLyric,
  LyricsCache,
  RateLimiter,
  DiffChecker,
};
