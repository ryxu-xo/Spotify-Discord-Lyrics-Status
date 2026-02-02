# Examples & Troubleshooting

⚠️ **Note**: This application uses Discord user tokens, which violates Discord's Terms of Service. Use at your own risk.

## Real-World Examples

### Example 1: Normal Operation Log

When everything works correctly, you'll see logs like this:

```
[2026-02-02T14:30:00.000Z] [INFO] Initializing Spotify Discord Lyrics Sync
[2026-02-02T14:30:00.150Z] [INFO] Configuration validated
[2026-02-02T14:30:02.500Z] [INFO] Discord service initialized
[2026-02-02T14:30:02.600Z] [INFO] Starting polling loop {"interval":1500}
[2026-02-02T14:30:02.700Z] [INFO] Application initialized successfully
[2026-02-02T14:30:05.200Z] [INFO] Track changed {"track":"Blinding Lights","artist":"The Weeknd"}
[2026-02-02T14:30:05.800Z] [DEBUG] Fetching lyrics from LRCLIB {"track":"Blinding Lights","artist":"The Weeknd"}
[2026-02-02T14:30:06.200Z] [DEBUG] Lyrics parsed successfully {"track":"Blinding Lights","lineCount":156}
[2026-02-02T14:30:08.800Z] [DEBUG] Discord status updated {"lyric":"Can't sleep until I feel your touch"}
[2026-02-02T14:30:12.300Z] [DEBUG] Discord status updated {"lyric":"And every time we touch, I swear I could fly"}
[2026-02-02T14:30:15.800Z] [DEBUG] Discord status updated {"lyric":"Can't take my eyes off you, if I could follow..."}
```

**What to notice**:
- ✅ Application initialized successfully
- ✅ Polling started
- ✅ Track detected and lyrics fetched
- ✅ Discord status updating as song progresses

---

### Example 2: No Lyrics Found (Graceful Fallback)

When LRCLIB doesn't have the track:

```
[2026-02-02T14:35:00.150Z] [INFO] Track changed {"track":"Obscure Local Band - Demo","artist":"Unknown"}
[2026-02-02T14:35:00.800Z] [DEBUG] Fetching lyrics from LRCLIB {"track":"Obscure Local Band - Demo","artist":"Unknown"}
[2026-02-02T14:35:05.200Z] [INFO] No lyrics found for track {"track":"Obscure Local Band - Demo","artist":"Unknown"}
[2026-02-02T14:35:05.300Z] [DEBUG] Discord status updated to show track name {"track":"Obscure Local Band - Demo","artist":"Unknown"}
```

**What's happening**:
- LRCLIB doesn't have this track
- Application displays track name instead
- User sees track info instead of lyrics
- No error - this is expected behavior

---

### Example 3: Track Paused/Stopped

When user pauses or stops playback:

```
[2026-02-02T14:40:15.000Z] [DEBUG] Track is paused
[2026-02-02T14:40:18.500Z] [INFO] Playback stopped
[2026-02-02T14:30:02.600Z] [DEBUG] Discord status cleared
```

**What's happening**:
- Application detects pause via Spotify API
- Skips status update during pause
- When playback stops completely, clears Discord status
- Resumes when user plays again

---

## Common Issues & Solutions

### Issue 1: Status Not Updating

**Symptoms**:
```
[2026-02-02T14:30:00.000Z] [DEBUG] Discord service initialized
[2026-02-02T14:30:03.500Z] [ERROR] Failed to update Discord status
```

Repeated error messages about status updates.

**Causes**:
1. Discord user token is invalid or expired
2. Discord API is down
3. User account has restrictions

**Solutions**:

Step 1: Verify token
```powershell
# Open .env and check DISCORD_USER_TOKEN value
# Should look like: mfa.xxx... or MTk4NjIyNDgzNjQ4MjI4ODA.Xxx...

# If it looks wrong or empty, get a new token:
# See SETUP.md Step 1 for instructions
```

Step 2: Restart application
```bash
# Stop current process (Ctrl+C)
# Then restart
npm start
```

---

### Issue 2: "Missing required environment variable" Error

**Symptoms**:
```
[2026-02-02T14:30:00.000Z] [ERROR] Failed to initialize application {"message":"Missing required environment variable: SPOTIFY_REFRESH_TOKEN"}
```

**Causes**:
- One or more required variables not set in `.env`
- Typo in variable name
- File is `.env.example` instead of `.env`

**Solutions**:

Step 1: Create proper `.env` file
```bash
# Make sure you have .env (not .env.example)
# In VS Code, right-click .env.example → Copy
# Then right-click → Paste as... → .env
```

Step 2: Verify all 4 required variables are set
```bash
# Open .env in VS Code and check:
DISCORD_TOKEN=<not empty? has value?>
SPOTIFY_CLIENT_ID=<not empty? has value?>
SPOTIFY_CLIENT_SECRET=<not empty? has value?>
SPOTIFY_REFRESH_TOKEN=<not empty? has value?>
```

Step 3: If any are empty, get them following SETUP.md
```
See SETUP.md sections:
- Step 1: Get DISCORD_TOKEN
- Step 2: Get SPOTIFY_CLIENT_ID & SPOTIFY_CLIENT_SECRET  
- Step 3: Get SPOTIFY_REFRESH_TOKEN
```

---

### Issue 3: Spotify API Returns 401 Unauthorized

**Symptoms**:
```
[2026-02-02T14:30:05.200Z] [WARN] Spotify token expired or invalid
[2026-02-02T14:30:05.300Z] [DEBUG] Failed to fetch currently playing track {"status":401,"message":"The access token expired"}
```

**Causes**:
- Refresh token is invalid or expired
- Spotify credentials are wrong
- Token was revoked

**Solutions**:

Step 1: Verify credentials
```
Go to Spotify Developer Dashboard:
1. Click your app
2. Check Client ID matches SPOTIFY_CLIENT_ID
3. Click "Show Client Secret" - compare with SPOTIFY_CLIENT_SECRET
```

Step 2: Get new refresh token
```
Follow Step 3 in SETUP.md:
1. Visit authorization URL in browser
2. Authorize the app
3. Extract authorization code from redirect URL
4. Use code to get new refresh token
5. Update .env with new SPOTIFY_REFRESH_TOKEN
```

Step 3: Restart application
```bash
npm start
```

---

### Issue 4: No Discord Status Updates

**Symptoms**:
```
[All logs look normal, but Discord status isn't changing]
```

**Checklist**:

1. Is Spotify actually playing?
```
Open Spotify app on any device and start playing a song
(Application can't know about playback if nothing is playing)
```

2. Is your Discord custom status visible?
```
Check your Discord profile
Ensure custom status is enabled in Discord settings
If application crashed, check logs for errors
```

3. Check polling is working
```
Add LOG_LEVEL=debug to .env and restart
Should see messages like:
[DEBUG] Fetching lyrics from LRCLIB
[DEBUG] Discord status updated
Every 1.5 seconds
```

4. Check Discord user token
```
Verify DISCORD_USER_TOKEN in .env is correct
If needed, get a new token (see SETUP.md Step 1)
Restart the application after updating
```

---

### Issue 5: Lyrics Not Syncing Correctly

**Symptoms**:
```
[Bot is running, but lyrics seem to be ahead/behind the actual playback]
```

**Causes**:
1. Network delay between Spotify API and your bot
2. Spotify playback progress slightly off
3. LRC file has incorrect timing

**Solutions**:

Step 1: Check polling interval
```
In .env, increase POLLING_INTERVAL:
POLLING_INTERVAL=5000  (was 3500)

More time between polls = less frequent but more accurate updates
```

Step 2: Check LRCLIB quality
```
Some tracks have poor LRC timing on LRCLIB
Try the song on https://lrclib.net/
Search your current song and check if timing looks right
```

Step 3: Check network latency
```
Run from terminal:
ping api.spotify.com

If ping > 100ms, network might be causing delays
Try bot from a faster network to compare
```

---

### Issue 6: Bot Crashes or Exits Unexpectedly

**Symptoms**:
```
Bot starts, then after a few minutes:
[Program exits]
```

**Causes**:
1. Uncaught exception in code
2. Out of memory (shouldn't happen, cache is small)
3. Network connection dropped
4. Discord/Spotify service outage

**Debug Steps**:

Step 1: Check full logs
```
Set LOG_LEVEL=debug and restart
Look for error messages before exit:

[ERROR] category {"message":"..."}
```

Step 2: Check system resources
```
PowerShell:
Get-Process node | Select-Object Name, Memory

If Memory > 500MB, cache is growing too much
Solution: Set CACHE_ENABLED=false in .env
```

Step 3: Check network
```
Run from terminal during next crash attempt:
ping spotify.com
ping lrclib.net
ping discord.com

If any fail, network issues
Try on different network/connection
```

Step 4: Enable core dumps (Linux)
```
ulimit -c unlimited
npm start

Core files will show where it crashed
```

---

### Issue 7: Discord 429 "Too Many Requests" Errors

**Symptoms**:
```
[2026-02-02T14:30:05.200Z] [ERROR] Failed to update Discord status {"message":"429 Too Many Requests"}
```

Discord is rate-limiting your status updates.

**Solutions**:

Step 1: Increase rate limit threshold
```
In .env:
RATE_LIMIT_THRESHOLD=2000  (was 1000)

This means wait 2 seconds minimum between updates
```

Step 2: Disable diff-checking temporarily to debug
```
This is harder - would require code modification
Instead, just increase threshold as Step 1
```

Step 3: Check Discord API status
```
Go to https://status.discord.com/
If Discord API is having issues, try again later
```

---

## Performance Optimization Tips

### Reduce API Calls

```env
# Increase polling interval
POLLING_INTERVAL=5000  # was 3500, saves 57% API calls

# Keep caching enabled
CACHE_ENABLED=true  # default, saves LRCLIB calls
```

### Reduce Memory Usage

```env
# Disable caching (if memory constrained)
CACHE_ENABLED=false

# This removes in-memory cache, reduces memory ~2MB
```

### Reduce Log Verbosity

```env
# Set to warn or error only
LOG_LEVEL=warn

# Reduces I/O, speeds up execution slightly
```

---

## Testing Checklist

Before deploying to production, verify:

- [ ] Bot comes online in Discord after `npm start`
- [ ] Spotify shows as active playback on your account
- [ ] Discord status updates within 5 seconds of playing new song
- [ ] Lyrics change as song progresses (every 5-10 seconds typically)
- [ ] Bot falls back gracefully when lyrics not found (shows "Listening to...")
- [ ] Pausing Spotify pauses Discord status updates
- [ ] Resuming Spotify resumes status updates
- [ ] Bot handles network hiccups without crashing (keep running 30 min)
- [ ] No excessive memory growth (check after 1 hour)
- [ ] Logs show reasonable output (no spam at INFO level)

---

## Performance Metrics to Monitor

After running 1-2 hours, check:

**Memory Usage**:
```powershell
Get-Process node | Select-Object Memory
# Should be 50-150 MB typically
```

**CPU Usage**:
```powershell
Get-Process node | Select-Object CPU
# Should be <5% idle (near 0)
```

**Spotify API Calls** (estimate):
```
Expected: ~1 call per 3.5 seconds = ~24 calls per minute
Over 1 hour: ~1,440 calls
Daily: ~34,560 calls
```

**Discord Status Updates**:
```
Expected: Changes every 5-10 seconds per song
Active playback: ~6-12 updates per minute
"""

---

## Getting Help

If none of the above solutions work:

1. **Check Discord API Status**: https://status.discord.com/
2. **Check Spotify Status**: https://developer.spotify.com/status
3. **Check LRCLIB Status**: https://lrclib.net/
4. **Review Full Logs**: Set `LOG_LEVEL=debug` and capture full error
5. **Test API Manually**: Use curl/Postman to test Spotify/Discord/LRCLIB APIs directly

---

**Good luck with your Spotify Discord Lyrics Bot! 🎵🎵**
