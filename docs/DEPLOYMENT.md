# Deployment Guide

This guide covers deploying StickerSentinel in various production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Platform-Specific Deployments](#platform-specific-deployments)
  - [Linux/Ubuntu Server](#linuxubuntu-server)
  - [Windows Server](#windows-server)
  - [Docker](#docker)
  - [Cloud Platforms](#cloud-platforms)
- [Post-Deployment](#post-deployment)
- [Monitoring](#monitoring)
- [Backup and Recovery](#backup-and-recovery)

---

## Prerequisites

Before deploying, ensure you have:

1. **Discord Bot Application**
   - Created at [Discord Developer Portal](https://discord.com/developers/applications)
   - Bot token obtained
   - Privileged intents enabled:
     - Server Members Intent
     - Message Content Intent

2. **Server Requirements**
   - Node.js 18 LTS or newer installed
   - Minimum 256MB RAM
   - Stable internet connection
   - Persistent storage for logs (optional)

3. **Discord Server Setup**
   - Bot invited with correct permissions (275415164928)
   - Log channel/thread created and bot has access
   - Bot role positioned above users it needs to moderate

---

## Platform-Specific Deployments

### Linux/Ubuntu Server

#### Using systemd (Recommended)

1. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone and setup the project**
   ```bash
   cd /opt
   sudo git clone https://github.com/yourusername/jasper_stickerclankers_detector.git
   cd jasper_stickerclankers_detector
   sudo npm install --production
   ```

3. **Create environment file**
   ```bash
   sudo nano .env
   ```
   Add your configuration:
   ```
   BOT_TOKEN=your_bot_token_here
   LOG_CHANNEL_ID=1234567890123456789
   ALERT_MENTION=<@&9876543210987654321>
   ```

4. **Create systemd service**
   ```bash
   sudo nano /etc/systemd/system/sticker-sentinel.service
   ```
   
   Add the following configuration:
   ```ini
   [Unit]
   Description=StickerSentinel Discord Bot
   After=network.target
   
   [Service]
   Type=simple
   User=nobody
   WorkingDirectory=/opt/jasper_stickerclankers_detector
   ExecStart=/usr/bin/node main.js
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal
   SyslogIdentifier=sticker-sentinel
   
   [Install]
   WantedBy=multi-user.target
   ```

5. **Enable and start the service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable sticker-sentinel
   sudo systemctl start sticker-sentinel
   ```

6. **Check status and logs**
   ```bash
   sudo systemctl status sticker-sentinel
   sudo journalctl -u sticker-sentinel -f
   ```

#### Using PM2

1. **Install PM2**
   ```bash
   sudo npm install -g pm2
   ```

2. **Start the bot**
   ```bash
   cd /path/to/jasper_stickerclankers_detector
   pm2 start main.js --name sticker-sentinel
   ```

3. **Configure auto-restart**
   ```bash
   pm2 save
   pm2 startup
   ```
   Follow the command output to enable startup script.

4. **Monitor the bot**
   ```bash
   pm2 status
   pm2 logs sticker-sentinel
   pm2 monit
   ```

5. **Advanced PM2 configuration** (optional)
   Create `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'sticker-sentinel',
       script: './main.js',
       instances: 1,
       autorestart: true,
       watch: false,
       max_memory_restart: '500M',
       env: {
         NODE_ENV: 'production'
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
     }]
   };
   ```
   
   Start with:
   ```bash
   pm2 start ecosystem.config.js
   ```

---

### Windows Server

#### Using Windows Task Scheduler

1. **Install Node.js**
   - Download from [nodejs.org](https://nodejs.org/)
   - Install with default options
   - Verify: `node --version`

2. **Setup project**
   ```powershell
   cd C:\bots
   git clone https://github.com/yourusername/jasper_stickerclankers_detector.git
   cd jasper_stickerclankers_detector
   npm install --production
   ```

3. **Create environment file**
   Create `C:\bots\jasper_stickerclankers_detector\.env`:
   ```
   BOT_TOKEN=your_bot_token_here
   LOG_CHANNEL_ID=1234567890123456789
   ALERT_MENTION=<@&9876543210987654321>
   ```

4. **Create startup script**
   Create `start-bot.bat`:
   ```batch
   @echo off
   cd /d C:\bots\jasper_stickerclankers_detector
   node main.js
   pause
   ```

5. **Configure Task Scheduler**
   - Open Task Scheduler
   - Create Basic Task
   - Name: "StickerSentinel Bot"
   - Trigger: "When the computer starts"
   - Action: "Start a program"
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `C:\bots\jasper_stickerclankers_detector\main.js`
   - Start in: `C:\bots\jasper_stickerclankers_detector`
   - Check "Run whether user is logged on or not"
   - Check "Run with highest privileges"

6. **Configure restart on failure**
   - Right-click task → Properties
   - Go to "Settings" tab
   - Check "If the task fails, restart every: 1 minute"
   - Set "Attempt to restart up to: 3 times"

#### Using NSSM (Non-Sucking Service Manager)

1. **Download NSSM**
   - Get from [nssm.cc](https://nssm.cc/download)
   - Extract to `C:\nssm`

2. **Install service**
   ```powershell
   cd C:\nssm\win64
   .\nssm.exe install StickerSentinel "C:\Program Files\nodejs\node.exe" "C:\bots\jasper_stickerclankers_detector\main.js"
   ```

3. **Configure service**
   ```powershell
   .\nssm.exe set StickerSentinel AppDirectory "C:\bots\jasper_stickerclankers_detector"
   .\nssm.exe set StickerSentinel DisplayName "StickerSentinel Discord Bot"
   .\nssm.exe set StickerSentinel Description "Protects against Discord sticker permission bypass"
   .\nssm.exe set StickerSentinel Start SERVICE_AUTO_START
   ```

4. **Start the service**
   ```powershell
   net start StickerSentinel
   ```

---

### Docker

#### Basic Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   
   # Create app directory
   WORKDIR /app
   
   # Install dependencies
   COPY package*.json ./
   RUN npm ci --only=production && npm cache clean --force
   
   # Copy application
   COPY . .
   
   # Run as non-root user
   USER node
   
   # Start bot
   CMD ["node", "main.js"]
   ```

2. **Create .dockerignore**
   ```
   node_modules
   npm-debug.log
   .env
   .git
   .gitignore
   README.md
   ```

3. **Build image**
   ```bash
   docker build -t sticker-sentinel:latest .
   ```

4. **Run container**
   ```bash
   docker run -d \
     --name sticker-sentinel \
     --restart unless-stopped \
     --env-file .env \
     sticker-sentinel:latest
   ```

5. **View logs**
   ```bash
   docker logs -f sticker-sentinel
   ```

#### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  sticker-sentinel:
    build: .
    container_name: sticker-sentinel
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    mem_limit: 512m
    cpus: 0.5
```

Deploy with:
```bash
docker-compose up -d
docker-compose logs -f
```

---

### Cloud Platforms

#### Heroku

1. **Create Heroku app**
   ```bash
   heroku create sticker-sentinel
   ```

2. **Add Procfile**
   ```
   worker: node main.js
   ```

3. **Set environment variables**
   ```bash
   heroku config:set BOT_TOKEN=your_token_here
   heroku config:set LOG_CHANNEL_ID=1234567890123456789
   heroku config:set ALERT_MENTION="<@&9876543210987654321>"
   ```

4. **Deploy**
   ```bash
   git push heroku main
   heroku ps:scale worker=1
   ```

5. **View logs**
   ```bash
   heroku logs --tail
   ```

#### AWS EC2

1. **Launch EC2 instance**
   - Amazon Linux 2 or Ubuntu 20.04
   - t3.micro or larger
   - Configure security group (outbound HTTPS)

2. **Connect and setup**
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   sudo yum install -y git
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   source ~/.bashrc
   nvm install 18
   ```

3. **Follow Linux deployment steps above**

#### Railway.app

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Initialize project**
   ```bash
   railway login
   railway init
   ```

3. **Set environment variables**
   ```bash
   railway variables set BOT_TOKEN=your_token_here
   railway variables set LOG_CHANNEL_ID=1234567890123456789
   ```

4. **Deploy**
   ```bash
   railway up
   ```

#### Google Cloud Run (Advanced)

1. **Create Cloud Run service**
2. **Note**: Cloud Run is designed for HTTP services. For a Discord bot, use Compute Engine or GKE instead.

---

## Post-Deployment

### Verification Checklist

After deployment, verify:

- [ ] Bot appears online in Discord
- [ ] Bot responds in startup logs with guild count
- [ ] Test message with external sticker is detected and deleted
- [ ] Log message appears in configured channel
- [ ] Alert mention triggers correctly (if configured)
- [ ] Bot survives restart/reboot
- [ ] Logs are accessible for debugging

### Testing Procedure

1. **Create test channel**
   - Restricted to moderators only

2. **Forward a message with external sticker**
   - Use a sticker from a different server
   - Forward the message to your test channel

3. **Verify bot behavior**
   - Message should be deleted within seconds
   - Log should appear in log channel
   - Alert mention should trigger

4. **Test with authorized user**
   - Grant "Use External Stickers" permission
   - Repeat test
   - Message should NOT be deleted

---

## Monitoring

### Log Management

**Linux (systemd):**
```bash
# View live logs
sudo journalctl -u sticker-sentinel -f

# View logs from last hour
sudo journalctl -u sticker-sentinel --since "1 hour ago"

# View logs with priority level
sudo journalctl -u sticker-sentinel -p err
```

**PM2:**
```bash
pm2 logs sticker-sentinel --lines 100
pm2 flush  # Clear logs
```

**Docker:**
```bash
docker logs sticker-sentinel --tail 100 -f
```

### Health Checks

Create a simple monitoring script:

```bash
#!/bin/bash
# check-bot.sh

PROCESS_NAME="node main.js"

if pgrep -f "$PROCESS_NAME" > /dev/null; then
    echo "Bot is running"
    exit 0
else
    echo "Bot is NOT running!"
    # Restart logic here
    exit 1
fi
```

Schedule with cron:
```bash
*/5 * * * * /path/to/check-bot.sh
```

### Resource Monitoring

Monitor bot performance:
```bash
# CPU and memory usage
ps aux | grep "node main.js"

# PM2 monitoring
pm2 monit

# Docker stats
docker stats sticker-sentinel
```

---

## Backup and Recovery

### What to Backup

1. **Environment file** (`.env`)
   - Store securely, encrypted
   - Do NOT commit to version control

2. **Configuration files**
   - systemd service files
   - PM2 ecosystem files
   - Docker compose files

3. **Logs** (optional)
   - For incident review
   - Regulatory compliance

### Recovery Procedure

1. **Reinstall dependencies**
   ```bash
   npm ci --production
   ```

2. **Restore .env file**
   ```bash
   cp backup/.env .env
   ```

3. **Restart service**
   ```bash
   # systemd
   sudo systemctl restart sticker-sentinel
   
   # PM2
   pm2 restart sticker-sentinel
   
   # Docker
   docker-compose restart
   ```

---

## Security Best Practices

1. **Never expose `.env` file**
   - Keep in `.gitignore`
   - Restrict file permissions: `chmod 600 .env`

2. **Use least privilege**
   - Run bot as non-root/non-admin user
   - Grant only required Discord permissions

3. **Keep dependencies updated**
   ```bash
   npm audit
   npm update
   ```

4. **Rotate bot token periodically**
   - Update in Discord Developer Portal
   - Update in `.env`
   - Restart bot

5. **Monitor for suspicious activity**
   - Unusual deletion patterns
   - API rate limit warnings
   - Failed permission checks

---

## Troubleshooting Deployment Issues

| Issue | Solution |
|-------|----------|
| Bot starts but doesn't respond | Check intents in Developer Portal |
| Service won't start on boot | Verify systemd/task scheduler configuration |
| High memory usage | Restart bot, check for memory leaks |
| Rate limit errors | Reduce activity or contact Discord support |
| Cannot delete messages | Check role hierarchy and permissions |

---

## Support

For deployment assistance, consult:
- Project [README.md](../README.md)
- [CONTRIBUTING.md](CONTRIBUTING.md) for development setup
- Discord.js documentation
- Platform-specific documentation (systemd, PM2, Docker, etc.)
