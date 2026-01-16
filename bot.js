require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const Database = require('better-sqlite3');
const fs = require('fs');

// Initialize database
const db = new Database('database.db');

// Create users table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    wallet_balance INTEGER DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    total_referrals INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    banned_at DATETIME,
    banned_reason TEXT,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add ban-related columns if they don't exist (for existing databases)
try {
  db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0`);
  console.log('✅ Added is_banned column');
} catch (e) {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN banned_at DATETIME`);
  console.log('✅ Added banned_at column');
} catch (e) {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN banned_reason TEXT`);
  console.log('✅ Added banned_reason column');
} catch (e) {
  // Column already exists
}

// Migrate search_history table to JSON storage
try {
  // Check if old columns exist
  const tableInfo = db.prepare("PRAGMA table_info(search_history)").all();
  const hasOldColumns = tableInfo.some(col => col.name === 'result_id' || col.name === 'response_name');

  if (hasOldColumns) {
    console.log('🔄 Migrating search_history table to JSON storage...');
    db.exec('DROP TABLE IF EXISTS search_history');
    console.log('✅ Old search_history table dropped');
  }
} catch (e) {
  console.error('Migration check error:', e.message);
}

// Create search_history table with JSON storage
db.exec(`
  CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    search_number TEXT NOT NULL,
    response_data TEXT NOT NULL,
    searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create referrals table
db.exec(`
  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id TEXT NOT NULL,
    referred_id TEXT NOT NULL,
    credits_earned INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_id, referred_id)
  )
`);

// Replace with your bot token from BotFather
const token = process.env.BOT_TOKEN;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// Store user states for number input flow
const userStates = {};

// Main keyboard with buttons
const mainKeyboard = {
  keyboard: [
    ['📱 Enter 10 Digit Number'],
    ['💰 Wallet', 'Refer'],
    ['❓ Help', 'ℹ️ About']
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

// Function to generate unique referral code
function generateReferralCode(telegramId) {
  return `REF${telegramId}`;
}

// Function to register or update user
function registerUser(user, referralCode = null) {
  // Check if user already exists
  const existingUser = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(user.id.toString());

  if (existingUser) {
    // User exists, just update their info
    db.prepare(`
      UPDATE users 
      SET username = ?, 
          first_name = ?, 
          last_name = ?, 
          last_active = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `).run(
      user.username || null,
      user.first_name || null,
      user.last_name || null,
      user.id.toString()
    );

    return { isNew: false };
  } else {
    // Generate unique referral code for new user
    const newReferralCode = generateReferralCode(user.id);
    let initialCredits = 10;
    let referrerId = null;

    // Check if they used a referral code
    if (referralCode && referralCode.startsWith('REF')) {
      const referrer = db.prepare('SELECT telegram_id, first_name FROM users WHERE referral_code = ?').get(referralCode);

      if (referrer) {
        referrerId = referrer.telegram_id;
        initialCredits = 15; // Bonus credits for using referral

        // Give referrer 5 credits
        db.prepare('UPDATE users SET wallet_balance = wallet_balance + 5, total_referrals = total_referrals + 1 WHERE telegram_id = ?').run(referrer.telegram_id);

        // Log the referral
        try {
          db.prepare('INSERT INTO referrals (referrer_id, referred_id, credits_earned) VALUES (?, ?, 5)').run(referrer.telegram_id, user.id.toString());
        } catch (e) {
          console.log('Referral already logged');
        }
      }
    }

    // New user, insert with referral data
    db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, last_name, wallet_balance, referral_code, referred_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id.toString(),
      user.username || null,
      user.first_name || null,
      user.last_name || null,
      initialCredits,
      newReferralCode,
      referrerId
    );

    return { isNew: true, usedReferral: !!referrerId, referralBonus: initialCredits - 10 };
  }
}

// /start command
bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'there';
  const referralCode = match[1] ? match[1].trim() : null;

  // Register user automatically with referral code
  const result = registerUser(msg.from, referralCode);

  let welcomeMessage;

  if (result.isNew) {
    // First time user
    if (result.usedReferral) {
      welcomeMessage = `
👋 Welcome ${userName}!

✅ **You have been registered successfully!**
🎁 **Referral Bonus: +${result.referralBonus} credits!**

You received ${10 + result.referralBonus} credits total (10 base + ${result.referralBonus} referral bonus)!

This is your first time using this bot. I'm here to help you search for information using mobile numbers.

📱 Click "Enter 10 Digit Number" to search information
💰 Check your wallet with "Wallet" button
🎁 Invite friends with /refer command
❓ Get help with /help command

Let's get started! 🚀
      `;
    } else {
      welcomeMessage = `
👋 Welcome ${userName}!

✅ **You have been registered successfully!**

You received 10 free credits to get started!

This is your first time using this bot. I'm here to help you search for information using mobile numbers.

📱 Click "Enter 10 Digit Number" to search information
💰 Check your wallet with "Wallet" button
🎁 Invite friends with /refer and earn credits!
❓ Get help with /help command

Let's get started! 🚀
      `;
    }
  } else {
    // Returning user
    welcomeMessage = `
👋 Welcome back, ${userName}!

🔄 **Your information has been updated.**

Great to see you again! Ready to search for more information?

📱 Click "Enter 10 Digit Number" to search information
💰 Check your wallet with "Wallet" button
🎁 Invite friends with /refer and earn credits!
❓ Get help with /help command

Let's continue! 🚀
    `;
  }

  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: mainKeyboard
  });

  console.log(`User ${chatId} (${userName}) - ${result.isNew ? '🆕 NEW USER registered' : '🔄 Returning user updated'}${result.usedReferral ? ' with referral!' : ''}`);
});

// /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  const helpMessage = `
📚 *Available Commands:*

/start - Start the bot and show main menu
/help - Show this help message
/about - Learn more about this bot
/refer - Get your referral link and earn credits

🔘 *Buttons:*

📱 Enter 10 Digit Number - Submit a 10-digit number
💰 Wallet - Check your balance and referral stats
❓ Help - Get help
ℹ️ About - Bot information

Just click the buttons or type commands to interact with me! 😊
  `;

  bot.sendMessage(chatId, helpMessage, {
    parse_mode: 'Markdown',
    reply_markup: mainKeyboard
  });
});

// /about command
bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;

  const aboutMessage = `
ℹ️ *About This Bot*

This is a Telegram bot built with Node.js that demonstrates:

✅ Custom keyboard buttons
✅ Number validation (10 digits)
✅ Interactive commands
✅ User-friendly interface

Created with ❤️ using node-telegram-bot-api

Version: 1.0.0
  `;

  bot.sendMessage(chatId, aboutMessage, {
    parse_mode: 'Markdown',
    reply_markup: mainKeyboard
  });
});

// /refer command - Show referral information
bot.onText(/\/refer/, (msg) => {
  const chatId = msg.chat.id;

  // Get user's referral data
  const user = db.prepare('SELECT referral_code, total_referrals, wallet_balance FROM users WHERE telegram_id = ?').get(chatId.toString());

  if (!user) {
    bot.sendMessage(chatId, 'Please use /start first to register!');
    return;
  }

  // Get total credits earned from referrals
  const referralStats = db.prepare('SELECT SUM(credits_earned) as total FROM referrals WHERE referrer_id = ?').get(chatId.toString());
  const creditsFromReferrals = referralStats?.total || 0;

  const botUsername = process.env.BOT_USERNAME || 'YourBot';
  const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

  const referralMessage = `
🎁 **Your Referral Program**

📋 **Your Referral Code:** \`${user.referral_code}\`

🔗 **Your Referral Link:**
${referralLink}

📊 **Your Stats:**
👥 Total Referrals: ${user.total_referrals}
💰 Credits Earned: ${creditsFromReferrals}
💳 Current Balance: ${user.wallet_balance}

🎯 **How it works:**
1. Share your referral link with friends
2. When they join using your link, they get **15 credits** (instead of 10)
3. You get **+5 credits** for each successful referral!

💡 **Tip:** The more friends you invite, the more credits you earn!

Share your link now and start earning! 🚀
  `;

  bot.sendMessage(chatId, referralMessage, {
    parse_mode: 'Markdown',
    reply_markup: mainKeyboard
  });
});

// Handle button clicks and messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Debug: Log EVERYTHING
  console.log('--- NEW MESSAGE ---');
  console.log('Full message object:', JSON.stringify(msg, null, 2));

  // PRIORITY HANDLE: Refer & Earn
  // BROAD MATCH: Checks for "Refer" OR "Earn" OR "🎁"

  // Write to debug file instead of console
  const debugLog = `\n=== ${new Date().toISOString()} ===\nChecking Refer button match...\nText value: ${text}\nText type: ${typeof text}\n`;
  fs.appendFileSync('debug.log', debugLog);

  if (text) {
    const matchLog = `Contains Refer? ${text.includes('Refer')}\nContains Earn? ${text.includes('Earn')}\nContains 🎁? ${text.includes('🎁')}\n`;
    fs.appendFileSync('debug.log', matchLog);
  }

  if (text && (text.includes('Refer') || text.includes('Earn') || text.includes('🎁'))) {
    fs.appendFileSync('debug.log', '✅ PRIORITY MATCH: Refer button\n');
    try {
      const user = db.prepare('SELECT referral_code, total_referrals, wallet_balance FROM users WHERE telegram_id = ?').get(chatId.toString());

      if (!user) {
        bot.sendMessage(chatId, 'Please use /start first to register!');
        fs.appendFileSync('debug.log', 'User not found, sent registration message\n');
        return;
      }

      const referralStats = db.prepare('SELECT SUM(credits_earned) as total FROM referrals WHERE referrer_id = ?').get(chatId.toString());
      const creditsFromReferrals = referralStats?.total || 0;
      const botUsername = process.env.BOT_USERNAME || 'YourBot';
      const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;

      const referralMessage = `
🎁 Your Referral Program

📋 Your Referral Code: ${user.referral_code}

🔗 Your Referral Link:
${referralLink}

📊 Your Stats:
👥 Total Referrals: ${user.total_referrals}
💰 Credits Earned: ${creditsFromReferrals}
💳 Current Balance: ${user.wallet_balance}

🎯 How it works:
1. Share your referral link with friends
2. When they join using your link, they get 15 credits (instead of 10)
3. You get +5 credits for each successful referral!

Share your link now and start earning! 🚀`;

      bot.sendMessage(chatId, referralMessage, {
        reply_markup: mainKeyboard
      });
      fs.appendFileSync('debug.log', '✅ Referral message sent successfully\n');
    } catch (error) {
      fs.appendFileSync('debug.log', `❌ Error in Refer handler: ${error.message}\n`);
      bot.sendMessage(chatId, '⚠️ Error fetching referral data. Please try /refer command.');
    }
    return;
  } else {
    // Log why it didn't match
    if (text) {
      const noMatchLog = `❌ NO MATCH for text: "${text}"\nChecks: Refer=${text.includes('Refer')}, Earn=${text.includes('Earn')}, Gift=${text.includes('🎁')}\n`;
      fs.appendFileSync('debug.log', noMatchLog);
    }
  }

  // Skip if it's a command (already handled)
  if (text && text.startsWith('/')) {
    return;
  }

  // Check if user is banned
  try {
    const user = db.prepare('SELECT is_banned, banned_reason FROM users WHERE telegram_id = ?').get(chatId.toString());
    if (user && user.is_banned === 1) {
      const banMessage = user.banned_reason
        ? `🚫 *You have been banned from using this bot.*\n\n📝 Reason: ${user.banned_reason}\n\nPlease contact the administrator if you believe this is a mistake.`
        : `🚫 *You have been banned from using this bot.*\n\nPlease contact the administrator if you believe this is a mistake.`;

      bot.sendMessage(chatId, banMessage, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      });
      return;
    }
  } catch (e) {
    // User might not exist yet, continue
  }

  // Update last active time (safely)
  try {
    db.prepare('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = ?').run(chatId.toString());
  } catch (e) {
    // User might not exist yet
  }

  // Debug: Log the received text with character codes
  console.log(`Received text from ${chatId}: "${text}"`);
  if (text) {
    console.log('Full string char codes:', Array.from(text).map(c => c.charCodeAt(0)).join(','));
  }

  // Handle "Enter 10 Digit Number" button
  if (text === '📱 Enter 10 Digit Number') {
    userStates[chatId] = 'awaiting_number';
    bot.sendMessage(chatId, '📱 Please enter a 10-digit number:', {
      reply_markup: {
        keyboard: [[{ text: '❌ Cancel' }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  // Handle "Help" button
  if (text === '❓ Help') {
    bot.sendMessage(chatId, '📚 Use /help to see all available commands and features.', {
      reply_markup: mainKeyboard
    });
    return;
  }

  // Handle "About" button
  if (text === 'ℹ️ About') {
    bot.sendMessage(chatId, 'ℹ️ Use /about to learn more about this bot.', {
      reply_markup: mainKeyboard
    });
    return;
  }

  // Handle "Wallet" button
  if (text === '💰 Wallet') {
    // Get user's wallet balance and referral data
    const user = db.prepare('SELECT wallet_balance, total_referrals, referral_code FROM users WHERE telegram_id = ?').get(chatId.toString());

    if (!user) {
      bot.sendMessage(chatId, 'Please use /start first to register!');
      return;
    }

    // Get total credits earned from referrals
    const referralStats = db.prepare('SELECT SUM(credits_earned) as total FROM referrals WHERE referrer_id = ?').get(chatId.toString());
    const creditsFromReferrals = referralStats?.total || 0;

    const balance = user.wallet_balance;

    const walletMessage = `
💰 *Your Wallet*

💵 *Current Balance:* ${balance} credits

🎁 *Referral Earnings:*
👥 Total Referrals: ${user.total_referrals}
💰 Credits from Referrals: ${creditsFromReferrals}

ℹ️ *How to use credits:*
• Each search costs 1 credit
• New users get 10 free credits
• Invite friends with /refer to earn more!

📊 *Your Stats:*
• Available Credits: ${balance}
• Status: ${balance > 0 ? '✅ Active' : '⚠️ Low Balance'}

💡 *Earn More Credits:*
Use /refer to get your referral link and earn 5 credits per friend!
    `;

    bot.sendMessage(chatId, walletMessage, {
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard
    });
    return;
  }



  // Handle "Cancel" button
  if (text === '❌ Cancel') {
    delete userStates[chatId];
    bot.sendMessage(chatId, '❌ Cancelled. What would you like to do next?', {
      reply_markup: mainKeyboard
    });
    return;
  }

  // Handle number input when user is in "awaiting_number" state
  if (userStates[chatId] === 'awaiting_number') {
    // Validate if input is exactly 10 digits
    const numberRegex = /^\d{10}$/;

    if (numberRegex.test(text)) {
      // Valid 10-digit number
      delete userStates[chatId];

      // Check wallet balance before search
      const user = db.prepare('SELECT wallet_balance FROM users WHERE telegram_id = ?').get(chatId.toString());
      const balance = user ? user.wallet_balance : 0;

      if (balance < 1) {
        // Insufficient balance
        bot.sendMessage(chatId, `❌ *Insufficient Balance!*\n\n💰 Your current balance: ${balance} credits\n💵 Required: 1 credit per search\n\nPlease contact the administrator to add more credits to your wallet.`, {
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard
        });
        return;
      }

      // Deduct 1 credit
      db.prepare('UPDATE users SET wallet_balance = wallet_balance - 1 WHERE telegram_id = ?').run(chatId.toString());

      // Show searching message
      bot.sendMessage(chatId, '🔍 Searching for information...\n💰 1 credit deducted', {
        reply_markup: mainKeyboard
      });

      // Call the API using environment variables
      const API_KEY = process.env.API_KEY || 'anish';
      const API_URL = process.env.API_URL || 'https://anishexploits.site/api/api.php';
      const apiUrl = `${API_URL}?key=${API_KEY}&num=${text}`;

      axios.get(apiUrl)
        .then(response => {
          const data = response.data;

          if (data.success && data.result && data.result.length > 0) {
            // API returned results
            const totalResults = data.result.length;

            // Send summary first
            bot.sendMessage(chatId, `✅ Found ${totalResults} result(s) for number: \`${text}\`\n\nShowing first 5 results:`, {
              parse_mode: 'Markdown'
            });

            // Display first 5 results
            const resultsToShow = data.result.slice(0, 5);

            resultsToShow.forEach((person, index) => {
              const resultMessage = `
📱 *Result ${index + 1}*

👤 *Name:* ${person.name || 'N/A'}
👨‍👦 *Father:* ${person.father_name || 'N/A'}
📞 *Mobile:* \`${person.mobile || 'N/A'}\`
📞 *Alt Mobile:* \`${person.alt_mobile || 'N/A'}\`
📍 *Address:* ${person.address ? person.address.substring(0, 100) + '...' : 'N/A'}
🌐 *Circle:* ${person.circle || 'N/A'}
🆔 *ID:* \`${person.id_number || 'N/A'}\`
              `;

              bot.sendMessage(chatId, resultMessage, {
                parse_mode: 'Markdown'
              });
            });

            if (totalResults > 5) {
              bot.sendMessage(chatId, `ℹ️ Showing 5 of ${totalResults} results. There are ${totalResults - 5} more results available.`, {
                reply_markup: mainKeyboard
              });
            } else {
              bot.sendMessage(chatId, '✅ All results displayed!', {
                reply_markup: mainKeyboard
              });
            }

            // Show remaining balance
            const updatedUser = db.prepare('SELECT wallet_balance FROM users WHERE telegram_id = ?').get(chatId.toString());
            const remainingBalance = updatedUser ? updatedUser.wallet_balance : 0;
            bot.sendMessage(chatId, `💰 Remaining balance: ${remainingBalance} credits`);

            // Save search history - store complete JSON response
            try {
              // Filter out results that already exist in database (by Result ID)
              const newResults = [];

              for (const person of data.result) {
                if (!person.id) {
                  // If no ID, include it (shouldn't happen but handle gracefully)
                  newResults.push(person);
                  continue;
                }

                // Check if this Result ID already exists for this user
                const existing = db.prepare(`
                  SELECT id FROM search_history 
                  WHERE telegram_id = ? AND response_data LIKE ?
                `).get(chatId.toString(), `%"id":${person.id},%`);

                if (existing) {
                  console.log(`Result ID ${person.id} already exists for user ${chatId} - skipping`);
                } else {
                  newResults.push(person);
                }
              }

              // Only store if there are new results
              if (newResults.length > 0) {
                db.prepare(`
                  INSERT INTO search_history 
                  (telegram_id, search_number, response_data)
                  VALUES (?, ?, ?)
                `).run(
                  chatId.toString(),
                  text,
                  JSON.stringify(newResults)
                );

                console.log(`Saved ${newResults.length} new results for number ${text} (${data.result.length - newResults.length} duplicates skipped)`);
              } else {
                console.log(`All ${data.result.length} results already exist for user ${chatId}, number ${text} - no new data to store`);
              }
            } catch (error) {
              console.error('Error saving search history:', error.message);
            }

          } else {
            // No results found
            bot.sendMessage(chatId, `❌ No information found for number: \`${text}\``, {
              parse_mode: 'Markdown',
              reply_markup: mainKeyboard
            });
          }

          console.log(`User ${chatId} searched for number: ${text} - Found ${data.result ? data.result.length : 0} results`);
        })
        .catch(error => {
          console.error('API Error:', error);

          // Refund the credit since search failed
          try {
            db.prepare('UPDATE users SET wallet_balance = wallet_balance + 1 WHERE telegram_id = ?').run(chatId.toString());
            console.log(`Refunded 1 credit to user ${chatId} due to API error`);
          } catch (dbError) {
            console.error('Error refunding credit:', dbError);
          }

          bot.sendMessage(chatId, '⚠️ Service temporarily unavailable. Please try again later.\n\n💰 Your credit has been refunded.', {
            reply_markup: mainKeyboard
          });
        });

    } else {
      // Invalid input
      const errorMessage = `
❌ *Invalid Input!*

Please enter exactly *10 digits*.

Examples of valid numbers:
• 9876543210
• 1234567890

Your input: "${text}"
Length: ${text ? text.length : 0} characters

Please try again or click ❌ Cancel to go back.
      `;

      bot.sendMessage(chatId, errorMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '❌ Cancel' }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    }
    return;
  }
});

// Inline keyboard example (optional feature)
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🌟 Option 1', callback_data: 'option_1' },
        { text: '🎯 Option 2', callback_data: 'option_2' }
      ],
      [
        { text: '🔗 Visit Website', url: 'https://telegram.org' }
      ]
    ]
  };

  bot.sendMessage(chatId, 'Choose an option:', {
    reply_markup: inlineKeyboard
  });
});

// Handle callback queries from inline keyboards
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Answer the callback query to remove loading state
  bot.answerCallbackQuery(query.id);

  if (data === 'option_1') {
    bot.sendMessage(chatId, '✅ You selected Option 1!');
  } else if (data === 'option_2') {
    bot.sendMessage(chatId, '✅ You selected Option 2!');
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

// Log when bot starts
console.log('🤖 Bot is running...');
console.log('Press Ctrl+C to stop.');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down bot...');
  db.close();
  console.log('✅ Database closed');
  process.exit(0);
});
