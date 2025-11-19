# StickerSentinel

A Discord moderation bot that protects against a Discord vulnerability/glitch allowing users to bypass sticker permissions by forwarding messages with glitched external stickers.

Discord currently has an unresolved bug/glitch/vulnerability that lets people forward messages to bypass the **Use External Stickers** permission (the exact public method is still unknown, but abuse is happening in the wild). Until Discord ships an official fix, this bot acts as a guardrail: it detects those forwarded stickers, deletes the offending message, and alerts moderators so abuse is contained.

---

**⚡ New to this bot? Start here:** [Quick Start Guide](docs/QUICKSTART.md) - Get running in under 5 minutes!

---

## Documentation

- **[Quick Start Guide](docs/QUICKSTART.md)** - Get up and running in 5 minutes
- [Setup & Usage Guide](README.md) (this file) - Complete documentation
- [Deployment Guide](docs/DEPLOYMENT.md) - Platform-specific deployment instructions
- [Contributing Guidelines](docs/CONTRIBUTING.md) - For developers and contributors
- [Changelog](docs/CHANGELOG.md) - Version history and updates
- [License](LICENSE) - ISC License details

## How it works

1. Listens for new guild messages that contain `messageSnapshots` (Discord's forward payload) and extracts every sticker reference.
2. Fetches each sticker (preferring caches first) to learn its origin guild and type.
3. Checks for any sticker that is either unknown, deleted, or clearly from another guild.
4. Verifies whether the forwarding member actually has the **Use External Stickers** permission.
5. If the sticker looks illegitimate and the user is not authorized, the message is deleted and a Components V2 card is posted to your chosen log channel/thread. Optional mentions (users/roles) can be pinged for immediate visibility.

## Required Discord permissions

Grant the bot the following guild permissions to ensure enforcement works reliably:

- `View Channel` / `Read Message History` – needed to see forwarded messages.
- `Manage Messages` – required to delete the violating post.
- `Read Message Content` intent – must be toggled on in the Developer Portal.
- `Manage Threads` – only needed if your log destination is a thread and the bot must auto-join it.

Without the above, the bot may silently skip enforcement.

## Requirements

- Node.js 22 LTS or newer
- discord.js v14.24.2 or compatible version
- A Discord bot application with the necessary intents enabled (Guilds, Guild Messages, Message Content, Guild Expressions, Guild Members, Guild Moderation)

## Setup

1. Clone the repository:

```powershell
git clone https://github.com/GuikinProjects/StickerSentinel.git
cd StickerSentinel
```

2. Install dependencies:

```powershell
npm install
```

3. Create a `.env` file in the project root with the following variables:

```/dev/null/.env.example#L1-3
BOT_TOKEN=your_bot_token_here
LOG_CHANNEL_ID=your_channel_or_thread_id
ALERT_MENTION=<@!123456789> or <@&987654321>
```

| Variable         | Description                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BOT_TOKEN`      | Discord bot token. Never commit this value—keep it in `.env`.                                                                                        |
| `LOG_CHANNEL_ID` | Channel or thread the bot should use for sticker violation logs. Threads are supported; the bot will auto-join if it has permission.                 |
| `ALERT_MENTION`  | Optional mention string such as `<@!123>` or `<@&456>` to ping a user/role when an incident is logged. Mention parsing is locked down to avoid spam. |

4. Invite the bot to your server using the following OAuth2 URL format:

```/dev/null/invite.txt#L1-2
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=275415164928&scope=bot
```

Required OAuth2 permissions (decimal: `275415164928`):
- View Channels
- Read Message History
- Send Messages
- Manage Messages
- Manage Threads

5. Ensure privileged intents are enabled in the Discord Developer Portal:
   - Navigate to your bot application
   - Go to the "Bot" section
   - Enable "Server Members Intent"
   - Enable "Message Content Intent"

## Running the bot

### Development

```powershell
npm start
```

The bot will log a ready message showing:
- Bot username and tag
- Number of guilds being monitored
- Configured log channel ID

### Production Deployment

#### Using PM2 (recommended for Linux/macOS)

```/dev/null/deploy.sh#L1-4
npm install -g pm2
pm2 start main.js --name sticker-sentinel
pm2 save
pm2 startup
```

#### Using Windows Task Scheduler

1. Open Task Scheduler
2. Create a new task with the action: `node "E:\path\to\main.js"`
3. Set trigger to "At startup" with a 30-second delay
4. Configure to restart on failure

#### Using Docker (optional)

Create a `Dockerfile`:

```/dev/null/Dockerfile#L1-7
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "main.js"]
```

Then build and run:

```/dev/null/docker.sh#L1-2
docker build -t sticker-sentinel .
docker run -d --env-file .env --restart unless-stopped sticker-sentinel
```

## Production checklist

- ✅ Enable privileged intents (Message Content, Guild Members) in the Discord Developer Portal under Bot settings.
- ✅ Set `BOT_TOKEN`, `LOG_CHANNEL_ID`, and optional `ALERT_MENTION` in `.env` before starting the bot.
- ✅ Never commit `.env` to version control (already in `.gitignore`).
- ✅ Ensure the bot's highest role sits above the users/roles it needs to moderate so deletions succeed.
- ✅ Grant the bot access to view and post in the log channel/thread specified by `LOG_CHANNEL_ID`.
- ✅ Run the bot under a process manager (PM2, systemd, Windows Task Scheduler, etc.) for auto-restart after crashes or host reboots.
- ✅ Consider directing stdout/stderr to a log aggregator so you can investigate failed sticker fetches.
- ✅ Test the bot with a forwarded message containing external stickers in a controlled channel before deploying server-wide.

## Troubleshooting

| Symptom                                                 | Likely cause                                               | Fix                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Bot exits with `Missing required environment variables` | `.env` lacks `BOT_TOKEN` or `LOG_CHANNEL_ID`.              | Update `.env`, then restart.                                                          |
| Messages with foreign stickers remain                   | Bot lacks `Manage Messages` or guild intents are disabled. | Adjust permissions, confirm intents in the Developer Portal, and re-invite if needed. |
| Log message never arrives                               | `LOG_CHANNEL_ID` is wrong or the bot cannot post there.    | Confirm the channel ID and that the bot can speak/join the thread.                    |
| Mention never fires                                     | `ALERT_MENTION` has an invalid format.                     | Use raw mention strings (`<@!123>` or `<@&456>`).                                     |

## What the bot logs

When a violation is detected, the bot posts a Discord Components V2 card to your log channel containing:

- **Violator information**: Username, ID, avatar thumbnail
- **Message details**: Original message link, channel link, timestamp
- **Deletion status**: Whether the message was successfully removed
- **Permission check**: Whether the user has "Use External Stickers" permission
- **Sticker details**: List of resolved stickers (name, type, guild ID) and any failed fetches
- **Optional ping**: Mentions the user/role specified in `ALERT_MENTION` if configured

## Known limitations

- The underlying Discord exploit is still not publicly documented, so this bot focuses on detection-by-origin and failsafe deletion rather than preventing the forward action itself.
- If Discord suppresses `messageSnapshots` in the future, the current detection mechanism will stop working and will need an update.
- Sticker fetches rely on Discord's API; transient API failures are captured in the embed but cannot always be retried immediately.
- The bot only processes messages with `messageSnapshots` (forwarded messages), so it won't catch stickers sent through other potential exploit methods.
- Rate limits: Discord.js automatically handles rate limiting, but excessive violations in a short time may cause delays in processing.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for:
- Development setup and guidelines
- Code architecture overview
- Testing procedures
- Pull request process

## License

ISC License - See [LICENSE](LICENSE) file for full details.

Copyright (c) 2025, StickerSentinel Contributors

## Support

For detailed deployment instructions, see [DEPLOYMENT.md](docs/DEPLOYMENT.md).

For version history and updates, see [CHANGELOG.md](docs/CHANGELOG.md).

For issues, questions, or contributions, please refer to the project repository or contact the maintainer.
