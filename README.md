![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Spotify API](https://img.shields.io/badge/Spotify-API-1DB954?logo=spotify)
![Discord](https://img.shields.io/badge/Discord-Status-5865F2?logo=discord)

# Spotify Discord Lyrics Status

Automatically sync your Spotify playback to your Discord custom status with real-time synced lyrics from LRCLIB.

> **⚠️ IMPORTANT DISCLAIMER**  
> This tool uses Discord **user tokens** (not bot tokens) to update your personal custom status. While this works perfectly, it technically violates Discord's Terms of Service as it's considered "self-botting". Use at your own risk. Discord may take action against accounts using automated user tokens, though this is rare for personal status updates.
> 
> **Recommendation**: Use on a secondary/alt account if concerned about potential ToS violations.

## Features

- **Real-time Lyric Synchronization**: Fetches synced lyrics from LRCLIB and updates Discord status in real-time
- **Smart Polling Engine**: Configurable polling interval (default 3-5 seconds) for efficient Spotify API usage
- **In-Memory Caching**: Caches lyrics per track to minimize redundant API calls
- **Rate Limiting & Diff-Checking**: Prevents Discord rate-limit errors by only updating when lyric lines actually change
- **Spotify OAuth2 Flow**: Secure token management with automatic refresh token handling
- **Robust Error Handling**: Graceful fallbacks for instrumental tracks, missing lyrics, and network timeouts
- **Comprehensive Logging**: Structured logging with multiple log levels for debugging

## Architecture

```
├── index.js                 # Main orchestrator and polling engine
├── spotifyService.js        # Spotify OAuth2 and API integration
├── lyricsService.js         # LRCLIB API and lyric fetching
├── discordService.js        # Discord user token status updater
├── utils.js                 # LRC parsing, caching, and rate limiting
├── logger.js                # Centralized logging utility
├── package.json             # Dependencies and metadata
├── .env.example             # Environment configuration template
└── README.md                # This file
```

## Prerequisites

- **Node.js**: v18.0.0 or higher (Latest LTS recommended)
- **Discord User Token**: Your personal Discord account token (see [setup](https://github.com/ryxu-xo/Spotify-Discord-Lyrics-Status/main/SETUP.md) guide)
- **Spotify Developer Credentials**: Register at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- **Spotify Refresh Token**: Obtained through OAuth2 Authorization Code Flow

## Installation

### 1. Clone or Download the Repository

```bash
cd spotify-discord-lyrics-status
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your tokens:

```env
DISCORD_USER_TOKEN=your_discord_user_token_here
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token_here
POLLING_INTERVAL=1500
LOG_LEVEL=info
CACHE_ENABLED=true
RATE_LIMIT_THRESHOLD=300
SYNC_OFFSET=500
```

## Configuration Details

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_USER_TOKEN` | Required | Your Discord user account token (NOT a bot token) |
| `SPOTIFY_CLIENT_ID` | Required | Spotify OAuth2 client ID |
| `SPOTIFY_CLIENT_SECRET` | Required | Spotify OAuth2 client secret |
| `SPOTIFY_REFRESH_TOKEN` | Required | Spotify refresh token for long-term access |
| `POLLING_INTERVAL` | 1500 | Milliseconds between Spotify polling cycles (lower = faster updates) |
| `LOG_LEVEL` | info | Logging level: error, warn, info, debug |
| `CACHE_ENABLED` | true | Enable in-memory lyric caching |
| `RATE_LIMIT_THRESHOLD` | 300 | Minimum milliseconds between Discord status updates |
| `SYNC_OFFSET` | 500 | Milliseconds to offset lyrics (compensates for network delay) |

## Setting Up Spotify Credentials

### Getting Your Spotify Refresh Token

1. Register your app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Set up Redirect URI in your app settings (e.g., `https://example.com`)
3. Use the [Spotify Authorization Code Flow](https://developer.spotify.com/documentation/general/guides/authorization/) to obtain your refresh token

Example flow using curl:

```bash
# Step 1: Get authorization code
# Visit: https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:8888/callback&scope=user-read-playback-state

# Step 2: Exchange authorization code for tokens
curl -X POST "https://accounts.spotify.com/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=AUTH_CODE&redirect_uri=http://localhost:8888/callback&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

The response will include `refresh_token` - save this value in your `.env` file.

### Getting Your Discord User Token

> **⚠️ CAUTION**: Never share your user token with anyone. Treat it like a password.

1. Open **Discord in your browser** (discord.com)
2. Press **F12** to open Developer Tools
3. Go to **Application** tab → **Local Storage** → `discord.com`
4. Find the `token` key and copy its value (remove quotes)
5. Paste into `.env` as `DISCORD_USER_TOKEN`

**Alternative method**:
1. Open Discord Web/Desktop
2. Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Go to **Network** tab
4. Refresh Discord
5. Click any request and look for `Authorization` header
6. Copy the token value (without "Bearer" prefix if present)

## Running the Application

### Development Mode

```bash
npm start
```

The application will:
1. Connect to Spotify API with your credentials
2. Begin polling Spotify every 1.5 seconds (configurable)
3. Fetch lyrics from LRCLIB for the current track
4. Update your Discord custom status with synced lyrics
5. Log all activities based on `LOG_LEVEL`

### Background Execution (Linux/macOS)

```bash
nohup npm start > app.log 2>&1 &
```

### With PM2 (Recommended for 24/7 Operation)

```bash
# Install PM2 globally
npm install -g pm2

# Start bot
pm2 start index.js --name "spotify-discord-bot"

# View logs
pm2 logs spotify-discord-bot

# Stop bot
pm2 stop spotify-discord-bot
```

## How It Works

### Polling Loop

1. **Initialize**: Application connects using your Discord user token and starts polling Spotify
2. **Fetch Track**: Every 3-5 seconds, queries Spotify's `/me/player/currently-playing` endpoint
3. **Track Change Detection**: If track ID changes, fetches lyrics from LRCLIB
4. **Lyric Sync**: Matches current playback progress (`progress_ms`) to synced lyric line
5. **Discord Update**: Updates custom status with current lyric (with diff-checking and rate-limiting)
6. **Fallback**: If lyrics unavailable, displays "Listening to [Track Name]"

### LRC Format Parsing

LRC (Lyrics for Carraoke) format example:
```
[00:00.00]Verse 1 lyrics
[00:05.50]More lyrics
[00:10.25]Even more lyrics
```

The application parses these timestamps and matches them to Spotify's `progress_ms`.

### Rate Limiting Strategy

- **Diff-Checking**: Only updates Discord status when the lyric line actually changes
- **Rate Limiter**: Enforces minimum time between updates (default: 1 second)
- **Combined**: Prevents Discord 429 rate-limit errors while maintaining smooth updates

### Caching Mechanism

- Lyrics are cached in memory per track (artist + name)
- Cache TTL: 10 minutes (tracks won't be re-fetched during active playback)
- Cache automatically cleared when track changes
- Can be disabled via `CACHE_ENABLED=false`

## Error Handling

### Spotify Token Expiry
- Automatic token refresh using refresh token
- Graceful retry on next polling cycle
- Logs token-related errors for debugging

### LRCLIB Not Found
- Falls back to "Listening to [Track Name]" in Discord status
- Logs info-level message (not an error)
- Resumes sync when track is found in LRCLIB

### Network Timeouts
- 5-second timeout for LRCLIB requests
- Graceful failure without stopping the polling loop
- Logs warnings with error details

### Discord Rate Limiting
- Diff-checking prevents unnecessary updates
- Rate limiter enforces minimum update interval
- Logs when rate limit threshold is not met

### Instrumental Tracks
- Detected from LRCLIB response
- Falls back to "Listening to [Track Name]"
- Gracefully handled without errors

## Troubleshooting

### Status not updating on Discord

**Check the logs:**
```
[2026-02-02T10:30:00.000Z] [INFO] Discord service initialized
[2026-02-02T10:30:05.000Z] [DEBUG] Fetching lyrics from LRCLIB
```

**Common causes:**
1. **Spotify not playing**: Ensure Spotify is actively playing on your account
2. **Token expired**: Check if `SPOTIFY_REFRESH_TOKEN` is valid
3. **Lyrics not found**: Track may not be in LRCLIB (application displays track name instead)

### "Missing required environment variable" error

Ensure all required variables in `.env` are set:
```bash
echo $DISCORD_TOKEN
echo $SPOTIFY_CLIENT_ID
echo $SPOTIFY_CLIENT_SECRET
echo $SPOTIFY_REFRESH_TOKEN
```

### High Discord API rate-limiting

Increase `RATE_LIMIT_THRESHOLD` in `.env`:
```env
RATE_LIMIT_THRESHOLD=2000  # 2 seconds minimum between updates
```

### Memory usage concerns

Disable caching if running on limited resources:
```env
CACHE_ENABLED=false
```

## API Rate Limits

- **Spotify**: 429 errors handled with backoff
- **LRCLIB**: 5-second timeout per request
- **Discord**: Protected by diff-checking + rate limiting

## Production Deployment

### Recommended Setup

1. **Environment**: Use a VPS or cloud server (AWS EC2, Linode, etc.)
2. **Process Manager**: Use PM2 with auto-restart on crashes
3. **Logging**: Forward logs to external service (e.g., ELK stack)
4. **Monitoring**: Set up alerts for process failures

### PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'spotify-lyrics-sync',
      script: './index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
```

Then run: `pm2 start ecosystem.config.js`

## License

MIT

## Credits

Created and maintained by [ryxu-xo](https://github.com/ryxu-xo)

Special thanks to:
- [LRCLIB](https://lrclib.net/) for providing synced lyrics API
- [Spotify Web API](https://developer.spotify.com/) for playback data
- [Discord API](https://discord.com/developers/docs) for custom status updates

## Support

For issues or feature requests, please open an issue on the repository.

---

**Built with ❤️ for Discord and Spotify enthusiasts by [ryxu-xo](https://github.com/ryxu-xo)**

---

## ⭐ Star This Repository

If you find this useful, please star the repository and share it!

[![GitHub stars](https://img.shields.io/github/stars/ryxu-xo/spotify-discord-lyrics-sync?style=social)](https://github.com/ryxu-xo/spotify-discord-lyrics-sync)


