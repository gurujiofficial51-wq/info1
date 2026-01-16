# Installation Guide - Telegram Info Bot

## Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Telegram Account** - To create a bot
- **Windows/Linux/Mac** - Any OS with Node.js support

## Quick Start (5 Minutes)

### 1. Get Your Bot Token

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow the prompts to create your bot
4. Copy the **bot token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Clone/Download the Project

```bash
# If you have the project folder
cd path/to/infobot

# Or download and extract the ZIP file
```

### 3. Install Dependencies

```bash
npm install
```

This will install:
- `node-telegram-bot-api` - Telegram bot framework
- `express` - Web server for admin panel
- `better-sqlite3` - Database
- `axios` - HTTP client
- `bcryptjs` - Password hashing
- `dotenv` - Environment variables
- `ejs` - Template engine

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example file
copy .env.example .env
```

Edit `.env` and add your bot token:

```env
# Telegram Bot Configuration
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
BOT_USERNAME=your_bot_username

# Admin Panel Configuration
ADMIN_PORT=3000
SESSION_SECRET=your-secret-key-here

# Default Admin Credentials (CHANGE THESE!)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123

# API Configuration
API_KEY=anish
API_URL=https://anishexploits.site/api/api.php
```

**⚠️ IMPORTANT:** Change the default admin password!

### 5. Start the Application

#### Option A: Manual Start (Development)

```bash
# Terminal 1 - Start the bot
node bot.js

# Terminal 2 - Start the admin panel
node admin.js
```

#### Option B: Using npm scripts

```bash
# Start bot
npm start

# Start admin panel
npm run admin
```

### 6. Access Admin Panel

Open your browser and go to:
```
http://localhost:3000
```

Login with:
- **Username:** admin
- **Password:** admin123 (or what you set in .env)

### 7. Test Your Bot

1. Open Telegram
2. Search for your bot username
3. Send `/start` command
4. Bot should respond with welcome message

## Production Deployment

### Using PM2 (Recommended)

PM2 keeps your bot running 24/7 and auto-restarts on crashes.

#### 1. Install PM2 Globally

```bash
npm install -g pm2
```

#### 2. Start with PM2

```bash
# Start bot
pm2 start bot.js --name telegram-bot

# Start admin panel
pm2 start admin.js --name admin-panel

# Save the process list
pm2 save

# Setup auto-start on system boot
pm2 startup
```

#### 3. Manage PM2 Processes

```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all

# Delete
pm2 delete all
```

### Using systemd (Linux)

Create service files:

**bot.service:**
```ini
[Unit]
Description=Telegram Info Bot
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/infobot
ExecStart=/usr/bin/node bot.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**admin.service:**
```ini
[Unit]
Description=Telegram Bot Admin Panel
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/infobot
ExecStart=/usr/bin/node admin.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable bot.service admin.service
sudo systemctl start bot.service admin.service
```

## Nginx Reverse Proxy (Optional)

For HTTPS and domain access:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Get SSL certificate:
```bash
sudo certbot --nginx -d yourdomain.com
```

## Database Backup

### Manual Backup

```bash
# Backup database
copy database.db database.backup.db

# Or with timestamp
copy database.db database.backup.%date:~-4,4%%date:~-10,2%%date:~-7,2%.db
```

### Automated Backup Script

Create `backup.bat` (Windows):
```batch
@echo off
set BACKUP_DIR=backups
if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%
copy database.db %BACKUP_DIR%\database_%date:~-4,4%%date:~-10,2%%date:~-7,2%.db
echo Backup completed!
```

Or `backup.sh` (Linux):
```bash
#!/bin/bash
BACKUP_DIR="backups"
mkdir -p $BACKUP_DIR
cp database.db $BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).db
echo "Backup completed!"
```

Schedule with cron (Linux):
```bash
# Backup daily at 2 AM
0 2 * * * /path/to/infobot/backup.sh
```

## Troubleshooting

### Bot Not Starting

**Error:** "Invalid token"
- Check your BOT_TOKEN in .env
- Make sure there are no spaces
- Get a new token from @BotFather

**Error:** "EADDRINUSE"
- Port 3000 is already in use
- Change ADMIN_PORT in .env
- Or stop the other process

### Database Issues

**Error:** "database is locked"
- Close all connections
- Restart the application
- Check file permissions

### Admin Panel Not Accessible

1. Check if admin.js is running
2. Verify ADMIN_PORT in .env
3. Check firewall settings
4. Try http://127.0.0.1:3000

## File Structure

```
infobot/
├── bot.js              # Main bot application
├── admin.js            # Admin panel server
├── database.db         # SQLite database
├── .env                # Environment variables (create this)
├── .env.example        # Environment template
├── package.json        # Dependencies
├── README.md           # Documentation
├── INSTALL.md          # This file
├── clear_history.js    # Utility script
└── views/              # Admin panel templates
    ├── dashboard.ejs
    ├── users.ejs
    ├── history.ejs
    ├── search.ejs
    ├── settings.ejs
    ├── broadcast.ejs
    └── login.ejs
```

## Features

✅ User registration with referral system  
✅ Wallet balance management  
✅ Search history tracking  
✅ Admin panel with authentication  
✅ User management (ban/unban/delete)  
✅ Broadcast messaging  
✅ Result ID-based duplicate detection  
✅ JSON storage for flexibility  

## Support

For issues or questions:
1. Check this installation guide
2. Review the README.md
3. Check the logs: `pm2 logs` or console output

## Security Checklist

Before going to production:

- [ ] Change default admin password
- [ ] Use strong SESSION_SECRET
- [ ] Enable HTTPS (SSL certificate)
- [ ] Setup firewall rules
- [ ] Regular database backups
- [ ] Keep Node.js updated
- [ ] Monitor logs for errors

## Next Steps

1. ✅ Install and configure
2. ✅ Test bot functionality
3. ✅ Customize welcome messages
4. ✅ Setup backups
5. ✅ Deploy to production
6. ✅ Monitor and maintain

---

**Need help?** Check the README.md for more details about features and usage.
