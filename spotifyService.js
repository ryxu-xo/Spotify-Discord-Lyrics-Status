/**
 * Spotify API Integration Module
 * Handles OAuth2 Authorization Code Flow and token management
 * Fetches currently playing track and playback progress
 */

const axios = require('axios');
const logger = require('./logger');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

class SpotifyService {
  constructor(clientId, clientSecret, refreshToken) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get a new access token using the refresh token
   * @throws {Error} If token refresh fails
   * @returns {Promise<string>} The new access token
   */
  async refreshAccessToken() {
    try {
      logger.debug('Refreshing Spotify access token');

      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
        'base64'
      );

      const response = await axios.post(
        SPOTIFY_AUTH_URL,
        {
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety margin
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      logger.debug('Spotify access token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to refresh Spotify access token', {
        status: error.response?.status,
        message: error.message,
      });
      throw new Error('Failed to refresh Spotify access token');
    }
  }

  /**
   * Ensure access token is valid, refresh if necessary
   * @throws {Error} If token refresh fails
   */
  async ensureValidToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Fetch currently playing track information
   * @throws {Error} If API call fails or user has no active playback
   * @returns {Promise<Object>} Currently playing track data
   */
  async getCurrentlyPlaying() {
    await this.ensureValidToken();

    try {
      const response = await axios.get(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      // Handle no active playback (204 No Content)
      if (!response.data || !response.data.item) {
        logger.debug('No active Spotify playback');
        return null;
      }

      const track = response.data.item;
      const artists = track.artists.map((a) => a.name).join(', ');

      return {
        id: track.id,
        name: track.name,
        artists,
        album: track.album.name,
        duration: track.duration_ms,
        progress: response.data.progress_ms,
        isPlaying: response.data.is_playing,
        externalUrl: track.external_urls.spotify,
      };
    } catch (error) {
      if (error.response?.status === 429) {
        logger.warn('Spotify API rate limited');
        throw new Error('Spotify API rate limited - backing off');
      }

      if (error.response?.status === 401) {
        logger.warn('Spotify token expired or invalid');
        this.accessToken = null;
        this.tokenExpiry = null;
        throw new Error('Spotify token invalid - will refresh on next attempt');
      }

      logger.error('Failed to fetch currently playing track', {
        status: error.response?.status,
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if currently playing or paused
   * @throws {Error} If API call fails
   * @returns {Promise<boolean>} True if currently playing
   */
  async isCurrentlyPlaying() {
    const track = await this.getCurrentlyPlaying();
    return track ? track.isPlaying : false;
  }
}

module.exports = SpotifyService;
