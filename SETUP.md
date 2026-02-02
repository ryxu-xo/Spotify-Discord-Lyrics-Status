# Spotify Discord Lyrics Sync - Setup Guide

⚠️ **IMPORTANT DISCLAIMER**
> This tool uses Discord **user tokens** (not bot tokens) to update your personal custom status. While this works perfectly, it technically violates Discord's Terms of Service as it's considered "self-botting". Use at your own risk. Discord may take action against accounts using automated user tokens, though this is rare for personal status updates.

## Quick Start Guide

This guide walks you through obtaining your Spotify and Discord credentials to run the application.

---

## Step 1: Get Discord User Token

### 1.1 Using Browser DevTools (Recommended)

1. Open **Discord** in your web browser (not the desktop app)
2. Log in to your account
3. Press **F12** to open Developer Tools
4. Go to the **Console** tab
5. Paste this code and press Enter:
   ```javascript
   (webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()
   ```
6. **Copy the token** (without quotes)
7. **Save this token** - you'll need it for `DISCORD_USER_TOKEN` in `.env`

⚠️ **Security Warning:** Never share your user token with anyone! Anyone with your token can access your Discord account.

### 1.2 Alternative Method: Network Tab

1. Open Discord in browser and press **F12**
2. Go to **Network** tab
3. Filter by **XHR**
4. Refresh the page (Ctrl+R)
5. Click any request to `discord.com/api`
6. Look for **Authorization** header in Request Headers
7. Copy the value (that's your token)

---

## Step 2: Create Spotify App & Get Credentials

### 2.1 Create Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account (create one if needed)
3. Click **"Create an App"**
4. Name it: `Spotify Discord Lyrics Status`
5. Accept terms and create the app
6. You now have:
   - **Client ID** - save this for `SPOTIFY_CLIENT_ID`
   - **Client Secret** - click "Show Client Secret" and save for `SPOTIFY_CLIENT_SECRET`

### 2.2 Set Redirect URI

1. In your app settings, click **"Edit Settings"**
2. In **Redirect URIs**, add: `https://example.com/callback`
3. Click **"Save"**

⚠️ **Note**: Spotify now blocks `localhost` redirect URIs. Use `https://example.com/callback` instead.

---

## Step 3: Obtain Spotify Refresh Token

This requires the OAuth2 Authorization Code Flow. Follow these steps:

### Option A: Using Browser & cURL (Recommended for Beginners)

#### Step 3A.1: Get Authorization Code

1. In your browser, visit this URL (replace `YOUR_CLIENT_ID`):
```
https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=https://example.com/callback&scope=user-read-playback-state
```

2. Click **"Agree"** to authorize the app
3. You'll be redirected to `https://example.com/callback?code=AUTHORIZATION_CODE`
4. **Copy the authorization code** from the URL (everything after `code=`)

#### Step 3A.2: Exchange Code for Refresh Token

1. Open PowerShell or Command Prompt
2. Run this command (replace `YOUR_CODE`, `YOUR_CLIENT_ID`, `YOUR_CLIENT_SECRET`):

```powershell
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("YOUR_CLIENT_ID:YOUR_CLIENT_SECRET"))
$body = "grant_type=authorization_code&code=YOUR_CODE&redirect_uri=https://example.com/callback"

$response = Invoke-WebRequest -Uri "https://accounts.spotify.com/api/token" `
    -Method POST `
    -Headers @{"Authorization" = "Basic $auth"; "Content-Type" = "application/x-www-form-urlencoded"} `
    -Body $body

$response.Content | ConvertFrom-Json | Select-Object -Property refresh_token
```

3. **Copy the refresh_token value** - save this for `SPOTIFY_REFRESH_TOKEN`

#### Alternative: Using cURL (if available)

```bash
curl -X POST "https://accounts.spotify.com/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=YOUR_CODE&redirect_uri=https://example.com/callback&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

The response JSON will contain `refresh_token`.

### Option B: Using Spotify Web Playback (Advanced)

If Option A doesn't work, use the [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk).

---

## Step 4: Configure Environment Variables

1. In VS Code, open the `Spotify-Title` folder
2. Create a file named `.env` (copy from `.env.example`)
3. Fill in your credentials:

```env
# Get from Discord (see Step 1)
DISCORD_USER_TOKEN=your_discord_user_token_here

# Get from Spotify Developer Dashboard
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# Get from OAuth2 Authorization Code Flow above
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token_here

# Optional Configuration (these have defaults)
POLLING_INTERVAL=1500
LOG_LEVEL=info
CACHE_ENABLED=true
RATE_LIMIT_THRESHOLD=300
SYNC_OFFSET=500
```

**⚠️ IMPORTANT**: Never commit `.env` to version control. It's in `.gitignore` by default.

---

## Step 5: Start the Application

### 5.1 First Time Setup

1. Open terminal in VS Code (Ctrl+`)
2. Run:
```bash
npm start
```

You should see output like:
```
[2026-02-02T10:30:00.000Z] [INFO] Initializing Spotify Discord Lyrics Sync
[2026-02-02T10:30:00.500Z] [INFO] Configuration validated
[2026-02-02T10:30:02.000Z] [INFO] Discord service initialized
[2026-02-02T10:30:02.100Z] [INFO] Application initialized successfully
[2026-02-02T10:30:05.000Z] [DEBUG] Fetching lyrics from LRCLIB
```

### 5.2 Check Discord Status

1. Open Discord
2. Look for your custom status (below your username)
3. It should show the current lyric from your Spotify track
4. As playback progresses, the status updates in real-time

---

## Troubleshooting

### Error: "Missing required environment variable"

**Cause**: One of your `.env` variables is missing or empty

**Fix**:
1. Open `.env` file
2. Ensure all 4 required variables have values:
   - `DISCORD_USER_TOKEN`
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN`
3. Restart the application

### Status doesn't update

**Check 1**: Is Spotify actually playing?
- Open Spotify and start playing a song

**Check 2**: Is your Discord status visible?
- Check your Discord profile
- Ensure custom status is enabled in settings

**Check 3**: Check the logs
- Set `LOG_LEVEL=debug` in `.env`
- Restart the application
- Look for error messages in the terminal

### "Unauthorized" error from Spotify

**Cause**: Invalid Spotify credentials

**Fix**:
1. Verify your `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are correct
2. Check that your app's Redirect URI includes `http://localhost:8888/callback`
3. Get a new refresh token following Step 3

### "Invalid Token" error from Discord

**Cause**: Invalid Discord user token

**Fix**:
1. Get a new Discord user token (see Step 1)
2. Update `DISCORD_USER_TOKEN` in `.env`
3. Restart the application

### Lyrics not showing

**Cause**: Track not found in LRCLIB database

**Fix**: This is normal. The application displays the track name instead
- Popular tracks usually have lyrics
- Niche or recent tracks may not

---

## Next Steps

### Run the Application in the Background

For continuous operation, use PM2:

```bash
# Install PM2 globally (one time)
npm install -g pm2

# Start the application
pm2 start index.js --name "spotify-lyrics-sync"

# View logs
pm2 logs spotify-lyrics-sync

# Stop the application
pm2 stop spotify-lyrics-sync

# Restart after reboot
pm2 startup
pm2 save
```

### Customize Application Behavior

Edit `.env` to adjust:
- `POLLING_INTERVAL`: How often to check Spotify (in milliseconds)
- `RATE_LIMIT_THRESHOLD`: How often to update Discord (in milliseconds)
- `SYNC_OFFSET`: Time offset to compensate for network delay (in milliseconds)
- `LOG_LEVEL`: How verbose the logs are (error, warn, info, debug)
- `CACHE_ENABLED`: Whether to cache lyrics (saves API calls)

### Deploy to Cloud

Popular options:
- **Heroku**: Free tier available, good for testing
- **AWS EC2**: Scalable, pay-as-you-go
- **DigitalOcean**: Simple droplets with PM2
- **Replit**: Free, easy to share

---

## Support

If you encounter issues:

1. **Read the logs carefully** - they often indicate the exact problem
2. **Check Discord/Spotify API status** - sometimes services have outages
3. **Verify all credentials** - token mismatches are the most common issue
4. **Try the bot in a test server** - conflicts with other bots?

---

## Next: How the Bot Works

See [README.md](./README.md) for detailed documentation on:
- Architecture and module breakdown
- How the polling engine works
- LRC format parsing
- Caching and rate limiting strategies
- Error handling details
