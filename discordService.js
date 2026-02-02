/**
 * Discord Custom Status Service Module
 * Uses Discord user token to directly update custom status
 * No bot permissions needed
 */

const axios = require('axios');
const logger = require('./logger');

class DiscordService {
  constructor(userToken) {
    this.userToken = userToken;
    this.apiBaseUrl = 'https://discord.com/api/v10';
    this.lastStatus = null;
    this.ready = true;
  }

  /**
   * Update Discord custom status via user token
   * @param {string} lyric - Status text to display
   * @throws {Error} If update fails
   */
  async setLyricStatus(lyric) {
    try {
      const text = lyric.substring(0, 128);

      // Skip if same as last status (diff check)
      if (text === this.lastStatus) {
        logger.debug('Status unchanged, skipping update');
        return;
      }

      await axios.patch(
        `${this.apiBaseUrl}/users/@me/settings`,
        {
          custom_status: {
            text: text,
            // emoji_name: '🎵',
          },
        },
        {
          headers: {
            Authorization: this.userToken,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      this.lastStatus = text;
      logger.debug('Discord status updated', {
        lyric: text.substring(0, 50),
      });
    } catch (error) {
      if (error.response?.status === 401) {
        logger.error('Discord user token invalid or expired', {
          message: error.message,
        });
      } else {
        logger.error('Failed to update Discord status', {
          message: error.message,
        });
      }
      throw error;
    }
  }

  /**
   * Update status to listening (fallback)
   * @param {string} trackName - Track name
   * @param {string} artistName - Artist name
   * @throws {Error} If update fails
   */
  async setListeningStatus(trackName, artistName = '') {
    try {
      const displayName = artistName
        ? `${trackName} by ${artistName}`
        : trackName;

      await this.setLyricStatus(`🎵 Listening to ${displayName}`);
    } catch (error) {
      logger.error('Failed to update Discord status', {
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Clear custom status
   * @throws {Error} If update fails
   */
  async clearStatus() {
    try {
      await axios.patch(
        `${this.apiBaseUrl}/users/@me/settings`,
        {
          custom_status: {
            text: '',
            emoji_name: null,
          },
        },
        {
          headers: {
            Authorization: this.userToken,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      this.lastStatus = null;
      logger.debug('Discord status cleared');
    } catch (error) {
      logger.error('Error clearing Discord status', {
        message: error.message,
      });
    }
  }

  /**
   * Check if service is ready
   * @returns {boolean} Always true for user token
   */
  isReady() {
    return this.ready;
  }

  /**
   * Logout (no-op for user token)
   */
  async logout() {
    logger.info('Discord service stopped');
  }
}

module.exports = DiscordService;
