# Render.com Deployment Guide - Red Devils Info Bot

## Prerequisites

1. **GitHub Account** - To host your code
2. **Render.com Account** - Sign up at https://render.com (free tier available)
3. **Telegram Bot Token** - From @BotFather

## Step 1: Prepare Your Repository

### 1.1 Initialize Git (if not already done)

```bash
cd c:\xampp\htdocs\infobot
git init
git add .
git commit -m "Initial commit - Red Devils Info Bot"
```

### 1.2 Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `red-devils-info-bot`
3. Don't initialize with README (we already have files)

### 1.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/red-devils-info-bot.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Render.com

### 2.1 Sign Up / Log In

1. Go to https://render.com
2. Sign up with GitHub (recommended)
3. Authorize Render to access your repositories

### 2.2 Create New Services

#### Option A: Using Blueprint (Recommended)

1. Click **"New"** → **"Blueprint"**
2. Connect your GitHub repository
3. Render will detect `render.yaml` and create both services automatically
4. Click **"Apply"**

#### Option B: Manual Setup

**For Bot Service:**
1. Click **"New"** → **"Background Worker"**
2. Connect your repository
3. Configure:
   - **Name:** `red-devils-bot`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node bot.js`
   - **Plan:** Free

**For Admin Panel:**
1. Click **"New"** → **"Web Service"**
2. Connect your repository
3. Configure:
   - **Name:** `red-devils-admin`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node admin.js`
   - **Plan:** Free

### 2.3 Set Environment Variables

For **Bot Service**, add these environment variables:
```
BOT_TOKEN=your_bot_token_here
BOT_USERNAME=your_bot_username
API_KEY=anish
API_URL=https://anishexploits.site/api/api.php
NODE_ENV=production
```

For **Admin Panel**, add these:
```
ADMIN_PORT=10000
SESSION_SECRET=your-secret-key-here
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=your-secure-password
NODE_ENV=production
```

**⚠️ IMPORTANT:** Use strong passwords and secrets!

## Step 3: Database Considerations

### SQLite on Render (Free Tier)

**Important:** Render's free tier uses ephemeral storage. Your database will reset on:
- Service restarts
- Deployments
- Inactivity (service sleeps after 15 min)

### Solutions:

#### Option 1: Use Render Disk (Paid)
Add to your service:
- Go to service settings
- Add a **Persistent Disk**
- Mount at `/data`
- Update database path in code

#### Option 2: Use External Database (Recommended)
Switch to PostgreSQL:
1. Add PostgreSQL service on Render (free tier available)
2. Update code to use PostgreSQL instead of SQLite
3. Install `pg` package: `npm install pg`

#### Option 3: Accept Data Loss (Testing Only)
For testing purposes, accept that data resets periodically.

## Step 4: Update Code for Production

### 4.1 Update Database Path (if using disk)

In `bot.js` and `admin.js`, change:
```javascript
// From:
const db = new Database('database.db');

// To:
const dbPath = process.env.DATABASE_PATH || 'database.db';
const db = new Database(dbPath);
```

Add environment variable:
```
DATABASE_PATH=/data/database.db
```

### 4.2 Update Admin Port

In `admin.js`, ensure it uses PORT from environment:
```javascript
const PORT = process.env.PORT || process.env.ADMIN_PORT || 3000;
```

Render automatically sets `PORT` for web services.

## Step 5: Deploy

1. **Commit changes:**
```bash
git add .
git commit -m "Configure for Render deployment"
git push
```

2. **Render auto-deploys** when you push to GitHub
3. Monitor deployment in Render dashboard

## Step 6: Verify Deployment

### Bot Service
1. Check logs in Render dashboard
2. Should see: "🤖 Bot is running..."
3. Test bot in Telegram

### Admin Panel
1. Get your service URL: `https://red-devils-admin.onrender.com`
2. Open in browser
3. Login with your credentials

## Troubleshooting

### Bot Not Responding
- Check environment variables (BOT_TOKEN)
- View logs in Render dashboard
- Ensure service is running (not sleeping)

### Admin Panel 502 Error
- Check if service is running
- Verify PORT configuration
- Check build logs for errors

### Database Issues
- Remember: Free tier has ephemeral storage
- Consider upgrading to persistent disk
- Or migrate to PostgreSQL

### Service Sleeping (Free Tier)
Free services sleep after 15 minutes of inactivity:
- First request takes ~30 seconds to wake up
- Upgrade to paid plan for 24/7 uptime
- Or use a ping service (UptimeRobot)

## Costs

**Free Tier Includes:**
- ✅ 750 hours/month per service
- ✅ Automatic HTTPS
- ✅ Custom domains
- ✅ Auto-deploy from GitHub
- ❌ Services sleep after 15 min inactivity
- ❌ No persistent storage

**Paid Plans:**
- **Starter:** $7/month per service
  - 24/7 uptime
  - No sleeping
  - Better performance

- **Persistent Disk:** $1/GB/month
  - For SQLite database
  - Survives restarts

## Production Checklist

- [ ] Code pushed to GitHub
- [ ] Environment variables set on Render
- [ ] Strong passwords configured
- [ ] Database strategy decided
- [ ] Both services deployed successfully
- [ ] Bot responding in Telegram
- [ ] Admin panel accessible
- [ ] Logs checked for errors
- [ ] Consider persistent storage
- [ ] Setup monitoring (optional)

## Monitoring (Optional)

Use **UptimeRobot** (free) to:
1. Prevent service from sleeping
2. Get alerts if service goes down
3. Monitor uptime

Setup:
1. Sign up at https://uptimerobot.com
2. Add HTTP monitor for your admin URL
3. Set check interval to 5 minutes

## Updating Your Deployment

```bash
# Make changes to code
git add .
git commit -m "Update description"
git push

# Render auto-deploys!
```

## Alternative: Deploy Both in One Service

If you want to run both bot and admin in one service:

**Create `start.sh`:**
```bash
#!/bin/bash
node bot.js &
node admin.js
```

**Update `render.yaml`:**
```yaml
startCommand: bash start.sh
```

This saves on service costs but both share resources.

---

**Need Help?**
- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- Check logs in Render dashboard

**Your bot is now live! 🚀**
