require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const db = new Database('database.db');
const PORT = process.env.ADMIN_PORT || 3000;

// Create admin users table
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create default admin if not exists
const adminExists = db.prepare('SELECT COUNT(*) as count FROM admin_users').get().count;
if (adminExists === 0) {
  const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
  db.prepare('INSERT INTO admin_users (username, password) VALUES (?, ?)').run(defaultUsername, hashedPassword);
  console.log('✅ Default admin created - Username:', defaultUsername);
  console.log('⚠️  Please change the default password after first login!');
}

// Create broadcast history table
db.exec(`
  CREATE TABLE IF NOT EXISTS broadcast_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_username TEXT NOT NULL,
    message TEXT NOT NULL,
    total_users INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    failed_sends INTEGER DEFAULT 0,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Login page
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

// Login POST
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Invalid username or password' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Dashboard route
app.get('/', requireAuth, (req, res) => {
  // Get statistics
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const todayUsers = db.prepare(`
    SELECT COUNT(*) as count FROM users 
    WHERE DATE(registered_at) = DATE('now')
  `).get().count;

  const recentUsers = db.prepare(`
    SELECT * FROM users 
    ORDER BY registered_at DESC 
    LIMIT 10
  `).all();

  res.render('dashboard', {
    totalUsers,
    todayUsers,
    recentUsers,
    username: req.session.username
  });
});

// Users list route
app.get('/users', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const users = db.prepare(`
    SELECT * FROM users 
    ORDER BY registered_at DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalPages = Math.ceil(totalUsers / limit);

  res.render('users', {
    users,
    currentPage: page,
    totalPages,
    totalUsers
  });
});

// Search user route
app.get('/search', requireAuth, (req, res) => {
  const query = req.query.q || '';

  if (!query) {
    return res.redirect('/users');
  }

  const users = db.prepare(`
    SELECT * FROM users 
    WHERE telegram_id LIKE ? 
       OR username LIKE ? 
       OR first_name LIKE ? 
       OR last_name LIKE ?
    ORDER BY registered_at DESC
    LIMIT 50
  `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);

  res.render('search', {
    users,
    query
  });
});

// Search History page
app.get('/history', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 50; // Show 50 records per page
  const offset = (page - 1) * limit;

  const rawSearches = db.prepare(`
    SELECT *
    FROM search_history
    ORDER BY searched_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  // Parse JSON and flatten results
  const searches = [];
  rawSearches.forEach(search => {
    try {
      if (!search.response_data) {
        console.log(`No response_data for search ID ${search.id}`);
        return;
      }

      const results = JSON.parse(search.response_data);
      console.log(`Parsed ${results.length} results for search ${search.search_number}`);

      results.forEach(person => {
        searches.push({
          id: search.id,
          telegram_id: search.telegram_id,
          search_number: search.search_number,
          searched_at: search.searched_at,
          result_id: person.id || null,
          mobile: person.mobile || null,
          response_name: person.name || null,
          father_name: person.father_name || null,
          address: person.address || null,
          alt_mobile: person.alt_mobile || null,
          circle: person.circle || null,
          id_number: person.id_number || null,
          email: person.email || null
        });
      });
    } catch (e) {
      console.error(`Error parsing JSON for search ID ${search.id}:`, e.message);
      console.error(`Raw data:`, search.response_data);
    }
  });

  const totalSearches = db.prepare('SELECT COUNT(*) as count FROM search_history').get().count;
  const totalPages = Math.ceil(totalSearches / limit);

  res.render('history', {
    searches,
    currentPage: page,
    totalPages,
    totalSearches
  });
});

// Settings page
app.get('/settings', requireAuth, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalCredits = db.prepare('SELECT SUM(wallet_balance) as total FROM users').get().total || 0;
  const lowBalanceUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE wallet_balance < 5').get().count;

  res.render('settings', {
    totalUsers,
    totalCredits,
    lowBalanceUsers,
    username: req.session.username
  });
});

// Add credits to user
app.post('/add-credits', requireAuth, (req, res) => {
  const { telegram_id, credits } = req.body;

  if (!telegram_id || !credits || credits < 1) {
    return res.json({ success: false, message: 'Invalid input' });
  }

  try {
    db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE telegram_id = ?').run(parseInt(credits), telegram_id);
    res.json({ success: true, message: `Added ${credits} credits successfully` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// Set credits for user
app.post('/set-credits', requireAuth, (req, res) => {
  const { telegram_id, credits } = req.body;

  if (!telegram_id || credits < 0) {
    return res.json({ success: false, message: 'Invalid input' });
  }

  try {
    db.prepare('UPDATE users SET wallet_balance = ? WHERE telegram_id = ?').run(parseInt(credits), telegram_id);
    res.json({ success: true, message: `Set balance to ${credits} credits` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// Broadcast page
app.get('/broadcast', requireAuth, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  // Get recent broadcasts
  const recentBroadcasts = db.prepare(`
    SELECT * FROM broadcast_history 
    ORDER BY sent_at DESC 
    LIMIT 10
  `).all();

  res.render('broadcast', {
    totalUsers,
    recentBroadcasts,
    username: req.session.username
  });
});

// Send broadcast
app.post('/send-broadcast', requireAuth, async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim().length === 0) {
    return res.json({ success: false, message: 'Message cannot be empty' });
  }

  if (message.length > 4000) {
    return res.json({ success: false, message: 'Message is too long (max 4000 characters)' });
  }

  try {
    // Get all users
    const users = db.prepare('SELECT telegram_id FROM users').all();
    const totalUsers = users.length;

    if (totalUsers === 0) {
      return res.json({ success: false, message: 'No users found to send broadcast' });
    }

    // Import bot from bot.js is not possible, so we need to create a new bot instance
    const TelegramBot = require('node-telegram-bot-api');
    const token = process.env.BOT_TOKEN;
    const bot = new TelegramBot(token);

    let successCount = 0;
    let failCount = 0;

    // Send message to each user
    for (const user of users) {
      try {
        await bot.sendMessage(user.telegram_id, `📢 *Broadcast Message*\n\n${message}`, {
          parse_mode: 'Markdown'
        });
        successCount++;
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Failed to send to ${user.telegram_id}:`, error.message);
        failCount++;
      }
    }

    // Save broadcast to history
    db.prepare(`
      INSERT INTO broadcast_history (admin_username, message, total_users, successful_sends, failed_sends)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.session.username, message, totalUsers, successCount, failCount);

    res.json({
      success: true,
      message: `Broadcast sent successfully!`,
      stats: {
        total: totalUsers,
        successful: successCount,
        failed: failCount
      }
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.json({ success: false, message: 'Error sending broadcast: ' + error.message });
  }
});

// Ban user
app.post('/ban-user', requireAuth, (req, res) => {
  const { telegram_id, reason } = req.body;

  if (!telegram_id) {
    return res.json({ success: false, message: 'Telegram ID is required' });
  }

  try {
    db.prepare(`
      UPDATE users 
      SET is_banned = 1, 
          banned_at = CURRENT_TIMESTAMP,
          banned_reason = ?
      WHERE telegram_id = ?
    `).run(reason || null, telegram_id);

    res.json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// Unban user
app.post('/unban-user', requireAuth, (req, res) => {
  const { telegram_id } = req.body;

  if (!telegram_id) {
    return res.json({ success: false, message: 'Telegram ID is required' });
  }

  try {
    db.prepare(`
      UPDATE users 
      SET is_banned = 0, 
          banned_at = NULL,
          banned_reason = NULL
      WHERE telegram_id = ?
    `).run(telegram_id);

    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// Delete user
app.post('/delete-user', requireAuth, (req, res) => {
  const { telegram_id } = req.body;

  if (!telegram_id) {
    return res.json({ success: false, message: 'Telegram ID is required' });
  }

  try {
    // Delete user's search history
    db.prepare('DELETE FROM search_history WHERE telegram_id = ?').run(telegram_id);

    // Delete user's referrals
    db.prepare('DELETE FROM referrals WHERE referrer_id = ? OR referred_id = ?').run(telegram_id, telegram_id);

    // Delete user
    db.prepare('DELETE FROM users WHERE telegram_id = ?').run(telegram_id);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// Change admin password
app.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.json({ success: false, message: 'All fields are required' });
  }

  if (new_password.length < 6) {
    return res.json({ success: false, message: 'New password must be at least 6 characters' });
  }

  try {
    // Get current admin user
    const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.session.userId);

    if (!admin) {
      return res.json({ success: false, message: 'Admin user not found' });
    }

    // Verify current password
    if (!bcrypt.compareSync(current_password, admin.password)) {
      return res.json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = bcrypt.hashSync(new_password, 10);

    // Update password
    db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(hashedPassword, req.session.userId);

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// API endpoint for stats
app.get('/api/stats', (req, res) => {
  const stats = {
    totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    todayUsers: db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE DATE(registered_at) = DATE('now')
    `).get().count,
    weekUsers: db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE DATE(registered_at) >= DATE('now', '-7 days')
    `).get().count,
    monthUsers: db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE DATE(registered_at) >= DATE('now', '-30 days')
    `).get().count
  };

  res.json(stats);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n📊 Admin Panel running at http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}/`);
  console.log(`   Users: http://localhost:${PORT}/users`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down admin panel...');
  db.close();
  process.exit(0);
});
