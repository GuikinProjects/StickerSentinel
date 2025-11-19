# Quick Start Guide

Get StickerSentinel running in under 5 minutes.

## Prerequisites

- Node.js 18 or newer ([download here](https://nodejs.org/))
- A Discord bot token ([create bot here](https://discord.com/developers/applications))

## Step 1: Enable Bot Intents

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your bot application
3. Go to the **Bot** section
4. Scroll to **Privileged Gateway Intents**
5. Enable these two intents:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
6. Click **Save Changes**

## Step 2: Invite Bot to Your Server

Use this URL (replace `YOUR_BOT_CLIENT_ID` with your bot's client ID):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=275415164928&scope=bot
```

**Where to find Client ID:**
- Discord Developer Portal → Your Application → General Information → Application ID

**Permissions included:**
- View Channels
- Read Message History
- Send Messages
- Manage Messages
- Manage Threads

## Step 3: Install the Bot

### Windows

```powershell
# Clone or download the project
cd E:\Dev-Workspace\jasper_stickerclankers_detector

# Install dependencies
npm install

# Create .env file
notepad .env
```

### Linux/Mac

```bash
# Clone or download the project
cd /path/to/jasper_stickerclankers_detector

# Install dependencies
npm install

# Create .env file
nano .env
```

## Step 4: Configure Environment Variables

Add this to your `.env` file:

```env
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
LOG_CHANNEL_ID=YOUR_CHANNEL_ID_HERE
ALERT_MENTION=<@&YOUR_ROLE_ID_HERE>
```

### How to Get These Values

**BOT_TOKEN:**
1. Discord Developer Portal → Bot section
2. Click **Reset Token** or **Copy** if visible
3. Paste into `.env`

**LOG_CHANNEL_ID:**
1. Enable Discord Developer Mode: Settings → Advanced → Developer Mode
2. Right-click your log channel → Copy Channel ID
3. Paste into `.env`

**ALERT_MENTION (Optional):**
- For role: Right-click role → Copy Role ID → Format as `<@&ROLE_ID>`
- For user: Right-click user → Copy User ID → Format as `<@USER_ID>`
- Leave blank if you don't want mentions

### Example `.env` File

```env
BOT_TOKEN=
LOG_CHANNEL_ID=
ALERT_MENTION=
```

## Step 5: Start the Bot

```bash
npm start
```

### Expected Output

```
[CONFIG] ✓ Configuration validated successfully
[CLIENT] ✓ Logged in as YourBot#1234
[CLIENT] Monitoring 1 guild(s)
[CLIENT] Log channel ID: 987654321098765432
```

## Step 6: Test the Bot

1. **Create a test channel** (restrict to moderators only)
2. **Forward a message with an external sticker** from another server
3. **Verify the bot:**
   - ✅ Deletes the forwarded message
   - ✅ Posts a log in your log channel
   - ✅ Mentions your configured role/user (if set)

### Test with an Authorized User

1. Grant a test user the **Use External Stickers** permission
2. Have them forward the same message
3. Message should **NOT** be deleted (bot respects permissions)

## Troubleshooting

### Bot Doesn't Start

**Error: `Missing required environment variables`**
- Check `.env` file exists in the project root
- Verify `BOT_TOKEN` and `LOG_CHANNEL_ID` are set
- Ensure no extra spaces or quotes

**Error: `Invalid token`**
- Regenerate token in Discord Developer Portal
- Copy entire token (no spaces)
- Update `.env` file

### Bot Doesn't Delete Messages

**Check these:**
1. ✅ Bot has **Manage Messages** permission
2. ✅ Bot's role is **above** the user's highest role
3. ✅ Bot can see the channel
4. ✅ Message was actually forwarded (has `messageSnapshots`)

### Log Messages Don't Appear

**Check these:**
1. ✅ `LOG_CHANNEL_ID` is correct
2. ✅ Bot has permission to **Send Messages** in that channel
3. ✅ Bot has permission to **View Channel**
4. ✅ If using a thread, bot has **Manage Threads** permission

### Intents Error on Startup

```
Error: Used disallowed intents
```

**Solution:**
- Go to Discord Developer Portal
- Bot section → Privileged Gateway Intents
- Enable **Server Members Intent** and **Message Content Intent**
- Restart the bot

## Next Steps

### Production Deployment

For production use, don't run the bot manually. Use a process manager:

**Linux/Mac (PM2):**
```bash
npm install -g pm2
pm2 start main.js --name sticker-sentinel
pm2 save
pm2 startup
```

**Windows (Task Scheduler):**
- See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions

**Docker:**
```bash
docker build -t sticker-sentinel .
docker run -d --env-file .env --restart unless-stopped sticker-sentinel
```

### Configure Role Hierarchy

1. Go to Server Settings → Roles
2. Drag the bot's role **above** users you want to moderate
3. Users with roles above the bot cannot be moderated

### Set Up Logging Channel

**Recommended setup:**
1. Create a private channel (e.g., `#sticker-violations`)
2. Restrict to moderators/admins only
3. Grant bot permission to view and post
4. Copy channel ID to `LOG_CHANNEL_ID` in `.env`

**Using threads:**
- Create a thread in an existing channel
- Copy thread ID to `LOG_CHANNEL_ID`
- Bot will auto-join the thread (needs **Manage Threads** permission)

## Common Questions

### Does this work with DM stickers?
No, the bot only monitors guild (server) messages. DMs are not processed.

### Will this slow down my server?
No, the bot only processes forwarded messages with stickers. Regular messages are ignored instantly.

### Can I whitelist certain users?
Not in version 1.0. This feature is planned for future releases.

### How do I update the bot?
```bash
git pull origin main
npm install
# Restart the bot
```

### How do I stop the bot?
```bash
# If running manually
Ctrl+C

# If using PM2
pm2 stop sticker-sentinel

# If using systemd
sudo systemctl stop sticker-sentinel
```

## Additional Resources

- [Full Documentation](../README.md)
- [Deployment Guide](DEPLOYMENT.md) - Platform-specific instructions
- [Contributing Guide](CONTRIBUTING.md) - For developers
- [Changelog](CHANGELOG.md) - Version history

## Need Help?

If you're still having issues:
1. Check [Troubleshooting](../README.md#troubleshooting) in the main README
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup
3. Ensure all prerequisites are met
4. Open an issue on the project repository

---

**You're all set!** Your bot should now be protecting your server against sticker permission bypasses. 🎉
