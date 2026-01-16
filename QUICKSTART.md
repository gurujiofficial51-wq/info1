# Quick Installation Guide

## 🚀 5-Minute Setup

### 1. Install Node.js
Download from: https://nodejs.org/

### 2. Get Bot Token
1. Open Telegram → Search `@BotFather`
2. Send `/newbot`
3. Copy your token

### 3. Install & Configure
```bash
cd infobot
npm install
copy .env.example .env
```

Edit `.env` - Add your token:
```
BOT_TOKEN=your_token_here
```

### 4. Run
```bash
# Terminal 1
node bot.js

# Terminal 2  
node admin.js
```

### 5. Access
- **Bot:** Search your bot in Telegram
- **Admin:** http://localhost:3000
- **Login:** admin / admin123

## 📦 Production (PM2)

```bash
npm install -g pm2
pm2 start bot.js --name telegram-bot
pm2 start admin.js --name admin-panel
pm2 save
pm2 startup
```

## 🔧 Common Commands

```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all
```

## 📁 Files

- `bot.js` - Main bot
- `admin.js` - Admin panel
- `.env` - Configuration
- `database.db` - Data storage

## ⚠️ Important

1. Change admin password in `.env`
2. Keep `.env` secret
3. Backup `database.db` regularly

## 🆘 Help

**Bot not starting?**
- Check BOT_TOKEN in `.env`
- Only one instance should run

**Admin panel not accessible?**
- Check if admin.js is running
- Try http://127.0.0.1:3000

---

**Full guide:** See INSTALL.md
