# Architecture & Implementation Details

## Project Overview

This is a production-ready application that synchronizes Spotify playback with Discord custom status using real-time synced lyrics from LRCLIB. The implementation follows modular architecture principles with clear separation of concerns.

⚠️ **Note**: This application uses Discord user tokens (self-bot approach) to update custom status, which violates Discord's Terms of Service. Use at your own risk.

---

## Module Architecture

### Core Modules

#### 1. **index.js** - Main Orchestrator
**Purpose**: Coordinates all services and implements the polling loop

**Key Classes**:
- `SpotifyDiscordBot`: Main orchestrator class
  - Manages lifecycle (initialization, polling, shutdown)
  - Coordinates Spotify → LRCLIB → Discord flow
  - Implements graceful error handling and signal handling

**Key Methods**:
- `initialize()`: Sets up all services and starts polling
- `startPolling()`: Initiates the polling loop at configured interval
- `poll()`: Single polling cycle (fetch track → get lyrics → update Discord)
- `shutdown()`: Graceful cleanup on termination

**Data Flow**:
```
[Polling Loop] 
    ↓
[Fetch from Spotify] 
    ↓
[Check if Track Changed]
    ↓
[Fetch/Cache Lyrics from LRCLIB]
    ↓
[Get Current Lyric at Progress]
    ↓
[Diff Check & Rate Limit]
    ↓
[Update Discord Status]
```

---

#### 2. **spotifyService.js** - Spotify API Integration
**Purpose**: Handles OAuth2 token management and Spotify API calls

**Key Class**: `SpotifyService`

**Responsibilities**:
- Manage OAuth2 refresh token flow
- Keep access token fresh (refresh before expiry)
- Fetch current playback information
- Handle Spotify API errors (401, 429, etc.)

**Key Methods**:
- `refreshAccessToken()`: Exchange refresh token for new access token
- `ensureValidToken()`: Check and refresh token if needed
- `getCurrentlyPlaying()`: Fetch current track, artist, progress, duration
- `isCurrentlyPlaying()`: Check playback state

**Error Handling**:
- 401 Unauthorized: Token expired, triggers refresh on next attempt
- 429 Rate Limited: Logs warning, continues polling
- 204 No Content: No active playback, returns null gracefully

**Token Lifecycle**:
```
[Bot Starts]
    ↓
[Use Initial Refresh Token]
    ↓
[Exchange for Access Token + Expiry]
    ↓
[Use Access Token for API Calls]
    ↓
[Check if Expiry < Current Time + 5 min]
    ↓
[If Yes: Refresh Token → New Access Token]
    ↓
[Continue]
```

---

#### 3. **lyricsService.js** - LRCLIB Integration
**Purpose**: Fetch and parse synced lyrics from LRCLIB

**Key Class**: `LyricsService`

**Responsibilities**:
- Query LRCLIB API for synced lyrics
- Handle fuzzy matching (track name, artist, duration)
- Detect instrumental tracks
- Parse LRC format strings
- Provide fallback with plain lyrics if synced unavailable

**Key Methods**:
- `fetchLyrics()`: Query LRCLIB, returns raw LRC or plain text
- `fetchAndParseLyrics()`: Fetch + parse LRC into timestamp array
- `searchLyrics()`: Full search with synced → plain fallback
- `convertPlainToTimed()`: Convert plain lyrics to simple timed format

**LRC Format Example**:
```
[00:00.00]First line
[00:05.50]Second line
[00:10.25]Third line
[01:23.45]Final line
```

**Parsed Output**:
```javascript
[
  { time: 0, lyric: "First line" },
  { time: 5500, lyric: "Second line" },
  { time: 10250, lyric: "Third line" },
  { time: 83450, lyric: "Final line" }
]
```

**Error Handling**:
- Timeout (>5s): Returns null, continues polling
- 404 Not Found: Returns null, logs at debug level
- Instrumental Detection: Returns special object, triggering fallback
- Parse Errors: Catches exceptions, returns null

---

#### 4. **discordService.js** - Discord User Token Status Updater
**Purpose**: Update Discord custom status using user token and REST API

**Key Class**: `DiscordService`

**Responsibilities**:
- Initialize with Discord user token
- Update custom status via Discord REST API
- Implement built-in diff-checking to prevent duplicate updates
- Handle Discord API errors gracefully
- Clear status on shutdown

**Key Methods**:
- `setLyricStatus()`: Update custom status with lyric text via PATCH /users/@me/settings
- `clearStatus()`: Remove custom status

**Discord API Endpoint Used**:
- `PATCH /users/@me/settings`: Updates user settings including custom_status
- Payload: `{ custom_status: { text: "lyric line", emoji_name: "🎵" } }`

**Status Update Process**:
```
[New Lyric Available]
    ↓
[Truncate to 128 chars]
    ↓
[Add "♪ " prefix]
    ↓
[Set Custom Activity]
    ↓
[Discord displays in member list]
```

---

#### 5. **utils.js** - Utility Functions & Classes
**Purpose**: LRC parsing, caching, rate limiting, and diff-checking

**Key Utilities**:

##### Parsing
- `parseLRC(lrcString)`: Parse LRC format → timestamp array
- `getLyricAtProgress(lyrics, progressMs)`: Find lyric matching current progress
- `truncateLyric(lyric, prefix)`: Truncate to 128-char Discord limit

##### Caching
- `LyricsCache`: In-memory cache with TTL
  - `generateKey(trackName, artistName)`: Create cache key
  - `set(trackName, artistName, lyrics)`: Store lyrics
  - `get(trackName, artistName)`: Retrieve if not expired
  - `clear()`: Flush all cache

**Cache Strategy**:
```
[Track 1 Plays]
    ↓
[Fetch Lyrics → Cache]
    ↓
[Progress Updates → Use Cache]
    ↓
[Track Changes]
    ↓
[Cache Cleared]
    ↓
[Track 2 Plays]
    ↓
[Fetch New Lyrics → Cache]
```

**TTL**: 10 minutes (configurable). Prevents memory bloat while keeping recent tracks cached.

##### Rate Limiting
- `RateLimiter`: Enforces minimum time between Discord updates
  - `canUpdate()`: Check if threshold passed since last update
  - `reset()`: Clear rate limiter state

**Purpose**: Prevent Discord 429 rate-limit errors. Default: 1 second minimum between updates.

##### Diff-Checking
- `DiffChecker`: Tracks last lyric to prevent duplicate updates
  - `hasChanged(lyric)`: Check if lyric differs from last
  - `reset()`: Clear state

**Combined Strategy**:
```
[New Lyric At Progress]
    ↓
[Diff Check: Is it different?] → No: Skip
    ↓ Yes
[Rate Check: Can update now?] → No: Wait
    ↓ Yes
[Update Discord Status]
```

This prevents both:
- Duplicate updates (same lyric twice)
- Rate-limit errors (too many updates)

---

#### 6. **logger.js** - Centralized Logging
**Purpose**: Structured logging with configurable levels

**Key Class**: `Logger`

**Log Levels** (in order of verbosity):
- `ERROR`: (0) Critical issues requiring attention
- `WARN`: (1) Non-fatal issues, potential problems
- `INFO`: (2) Important events and status
- `DEBUG`: (3) Detailed diagnostic information

**Log Format**:
```
[ISO-8601 Timestamp] [Level] Message {optionalData}
```

**Example Output**:
```
[2026-02-02T10:30:00.000Z] [INFO] Discord service initialized {"userId":"123456789"}
[2026-02-02T10:30:05.000Z] [DEBUG] Fetching lyrics from LRCLIB {"track":"Blinding Lights","artist":"The Weeknd"}
[2026-02-02T10:30:10.000Z] [WARN] LRCLIB API error {"status":404,"message":"Not found"}
```

**Configuration**: Set `LOG_LEVEL` in `.env` to control verbosity.

---

## Data Flow Diagram

### Complete Polling Cycle

```
┌─────────────────────────────────────────────────────────┐
│                    START POLLING LOOP                    │
│           (runs every POLLING_INTERVAL ms)               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌─────────────────────────┐
         │ Check Discord Service   │
         └────────┬────────────────┘
                  │
          No?─────┼─────→ Skip cycle
                  │
          Yes     ▼
         ┌─────────────────────────────┐
         │ Fetch Currently Playing     │
         │ from Spotify /me/player     │
         └────────┬────────────────────┘
                  │
          Track?──┼──→ No? ──→ Clear Discord Status ──→ [End]
                  │
          Yes     ▼
         ┌──────────────────────┐
         │ Track ID Changed?    │
         └────┬─────────────┬───┘
              │             │
         Yes  │             No
              │             │
              ▼             │
         ┌──────────────────┼─────────┐
         │ Fetch Lyrics from│LRCLIB   │
         │ (or from cache)  │         │
         └──────────────────┼─────────┘
                            │
                     ┌──────┴───────┐
                     │              │
                     ▼              ▼
         ┌─────────────────┐  ┌──────────────┐
         │ Has Lyrics?     │  │ Is Paused?   │
         └────┬────────┬───┘  └──┬─────────┬─┘
              │        │         │         │
         Yes  │        No        Yes       No
              │        │         │         │
              │        │    [Skip]         │
              │        │                   │
              └────────┼───────────────────┘
                       │
                       ▼
         ┌──────────────────────────┐
         │ Get Lyric at progress_ms │
         └────┬────────────────────┘
              │
          Has Lyric?─────→ No? ──→ Use "Listening to [Track]"
              │
         Yes  ▼
         ┌─────────────────────────┐
         │ Diff Check: Changed?    │
         └────┬──────────┬──────────┘
              │          │
         Yes  │          No
              │          │
              │     [Skip]
              ▼
         ┌──────────────────────────┐
         │ Rate Limit Check         │
         │ (1000ms min between)     │
         └────┬──────────┬──────────┘
              │          │
         Yes  │          No
              │          │
              │     [Skip]
              ▼
         ┌──────────────────────────┐
         │ Truncate Lyric to 128ch  │
         │ Add "♪ " Prefix          │
         └────┬─────────────────────┘
              │
              ▼
         ┌──────────────────────────┐
         │ Update Discord Status    │
         │ setLyricStatus()         │
         └────┬─────────────────────┘
              │
              ▼
         ┌──────────────────────────┐
         │    END CYCLE             │
         │ Wait POLLING_INTERVAL ms │
         └──────────────────────────┘
```

---

## Configuration Parameters

| Param | Default | Range | Impact |
|-------|---------|-------|--------|
| `POLLING_INTERVAL` | 3500ms | 1000-10000 | How frequently Spotify API is queried. Lower = more responsive but more API calls |
| `RATE_LIMIT_THRESHOLD` | 1000ms | 500-5000 | Minimum time between Discord status updates. Prevents 429 errors |
| `CACHE_ENABLED` | true | boolean | Whether to cache lyrics in memory. Reduces LRCLIB calls |
| `LOG_LEVEL` | info | error/warn/info/debug | Verbosity of console output |

**Recommended Settings**:
- **Responsive**: `POLLING_INTERVAL=2000, RATE_LIMIT_THRESHOLD=500`
- **Balanced**: `POLLING_INTERVAL=3500, RATE_LIMIT_THRESHOLD=1000` (default)
- **Conservative**: `POLLING_INTERVAL=5000, RATE_LIMIT_THRESHOLD=2000`

---

## Error Recovery Strategies

### Spotify Token Expiry
```
Request fails with 401
    ↓
Set accessToken = null
    ↓
Continue polling
    ↓
Next poll: ensureValidToken() detects null
    ↓
refreshAccessToken() called
    ↓
New token obtained
    ↓
Request succeeds
```

### LRCLIB Timeout
```
Request exceeds 5 seconds
    ↓
Catch timeout error
    ↓
Return null
    ↓
Log warning
    ↓
Continue polling
    ↓
Next cycle tries again (no permanent impact)
```

### Track Not Found
```
LRCLIB returns 404
    ↓
Return null
    ↓
Discord status shows "Listening to [Track Name]"
    ↓
Continue polling
    ↓
When track changes, try fetching again
```

### Discord Service Unavailable
```
Polling cycle continues
    ↓
Discord API returns error
    ↓
Error logged, status update skipped
    ↓
Try again next interval
    ↓
When Discord API is available, updates resume automatically
```

---

## Performance Characteristics

### Memory Usage

**Per Track**:
- Track metadata: ~500 bytes
- Parsed lyrics: ~100 bytes per lyric line
- Typical song (3-4 min): ~15-30 KB in cache

**Total Cache**:
- Default: 10 songs cached = 150-300 KB
- 100 songs cached = 1.5-3 MB
- Essentially negligible on modern systems

### API Calls

**Per Song (3-4 minute song)**:
- Spotify: ~60-80 calls (at 3.5s interval) = 1-2 calls per second
- LRCLIB: 1 call per new song = minimal
- Discord: ~30-50 updates (cached after changes) = minimal

**Spotify Rate Limits**: 
- Public API: No official documented limit, but ~150k calls/month is safe
- This application: ~2M calls/month worst case (excessive usage) - well within safe range

### Network Bandwidth

**Per Polling Cycle**:
- Spotify API response: ~2-3 KB
- Discord update: <1 KB
- LRCLIB response: ~10-50 KB (once per track)

**Total**: ~5-10 MB/day under normal usage

---

## Deployment Scenarios

### Local Development
```
npm start
```
Runs in foreground, logs to console, exits on Ctrl+C.

### Background on Windows (PowerShell)
```powershell
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "index.js"
```

### Linux/macOS Background
```bash
nohup npm start > app.log 2>&1 &
```

### Production with PM2
```bash
pm2 start index.js --name "spotify-lyrics-sync"
pm2 save
pm2 startup
```
Auto-restarts on crash, persists after reboot.

### Docker Container
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
```

---

## Monitoring & Debugging

### Check Logs
```bash
# View last 50 lines
tail -50 app.log

# Follow logs in real-time
tail -f app.log

# Search for errors
grep ERROR app.log

# Count events
grep "Track changed" app.log | wc -l
```

### Set Debug Mode
```env
LOG_LEVEL=debug
```

### Monitor Memory
```bash
# Linux
ps aux | grep node | grep index.js

# Windows PowerShell
Get-Process node
```

### Check API Health
```bash
# Spotify health
curl https://api.spotify.com/v1/me/player -H "Authorization: Bearer YOUR_TOKEN"

# LRCLIB health
curl https://lrclib.net/api/get?track_name=Blinding%20Lights&artist_name=The%20Weeknd

# Discord health
curl https://discord.com/api/v10/users/@me
```

---

## Security Considerations

### Token Storage
- Never commit `.env` to version control
- Use strong file permissions: `chmod 600 .env` (Linux/macOS)
- Rotate tokens regularly (~quarterly)

### Secret Management (Production)
- Use environment variables only (not hardcoded)
- Consider AWS Secrets Manager, HashiCorp Vault for sensitive data
- Enable 2FA on Spotify/Discord developer accounts

### API Key Exposure
- Never log tokens or credentials
- Rotate immediately if exposed
- Monitor API usage for suspicious activity

---

## Future Enhancements

Potential improvements for future versions:

1. **Multi-User Support**: Track multiple Discord users' Spotify accounts
2. **Lyric Display**: Show full lyric window with highlighted current line
3. **Statistics**: Track most played songs, artists, etc.
4. **Web Dashboard**: Real-time monitoring via web interface
5. **Database Persistence**: Store lyrics permanently instead of in-memory
6. **Voice Integration**: Play lyrics as voice in Discord VC
7. **Custom Formatting**: User-customizable Discord status template
8. **WebSocket API**: Real-time communication instead of polling

---

## License

MIT - See LICENSE file for details

---

**This documentation provides complete architectural and implementation details for developers and operators of the Spotify Discord Lyrics Bot.**
