# Telegram Bot - Node.js

A feature-rich Telegram bot built with Node.js that includes custom keyboards, number validation, and interactive commands.

## Features

- ✅ Custom keyboard with interactive buttons
- ✅ 10-digit number validation
- ✅ Command handlers (`/start`, `/help`, `/about`)
- ✅ User state management
- ✅ Inline keyboards (bonus feature)
- ✅ Error handling
- ✅ Environment-based configuration

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A Telegram account

## Setup Instructions

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Start a chat and send `/newbot`
3. Follow the instructions to choose a name and username for your bot
4. Copy the **bot token** provided by BotFather (it looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Install Dependencies

```bash
cd c:\xampp\htdocs\infobot
npm install
```

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Open `.env` file and replace `your_bot_token_here` with your actual bot token:
   ```
   BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

### 4. Run the Bot

```bash
npm start
```

You should see:
```
🤖 Bot is running...
Press Ctrl+C to stop.
```

## Usage

### Available Commands

- `/start` - Start the bot and display the main menu
- `/help` - Show help message with all available commands
- `/about` - Display information about the bot
- `/menu` - Show inline keyboard example (bonus feature)

### Custom Keyboard Buttons

- **📱 Enter 10 Digit Number** - Prompts you to enter a 10-digit number
- **❓ Help** - Quick access to help
- **ℹ️ About** - Quick access to about information

### How to Use Number Input

1. Click the "📱 Enter 10 Digit Number" button
2. Enter exactly 10 digits (e.g., `9876543210`)
3. The bot will validate and confirm your number
4. If invalid, you'll get an error message with examples

## Project Structure

```
infobot/
├── bot.js              # Main bot application
├── package.json        # Project dependencies
├── .env                # Environment variables (create this)
├── .env.example        # Environment template
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Customization

### Adding New Commands

Add a new command handler in `bot.js`:

```javascript
bot.onText(/\/mycommand/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Response to my command');
});
```

### Modifying Keyboard Buttons

Edit the `mainKeyboard` object in `bot.js`:

```javascript
const mainKeyboard = {
  keyboard: [
    [{ text: 'Button 1' }, { text: 'Button 2' }],
    [{ text: 'Button 3' }]
  ],
  resize_keyboard: true
};
```

### Saving Numbers to Database

In the number validation section (line ~150), add your database logic:

```javascript
if (numberRegex.test(text)) {
  // Add your database save logic here
  // Example: await saveToDatabase(chatId, text);
  
  delete userStates[chatId];
  // ... rest of the code
}
```

## Troubleshooting

### Bot not responding
- Check if the bot token in `.env` is correct
- Ensure the bot is running (`npm start`)
- Check your internet connection

### Polling errors
- Make sure only one instance of the bot is running
- Verify the bot token is valid
- Check if you have the latest version of dependencies

### Dependencies not installing
- Update npm: `npm install -g npm@latest`
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

## Technologies Used

- [Node.js](https://nodejs.org/) - JavaScript runtime
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) - Telegram Bot API wrapper
- [dotenv](https://github.com/motdotla/dotenv) - Environment variable management

## License

ISC

## Support

For issues or questions:
1. Check the [node-telegram-bot-api documentation](https://github.com/yagop/node-telegram-bot-api/blob/master/doc/api.md)
2. Review [Telegram Bot API documentation](https://core.telegram.org/bots/api)

---

**Happy Botting! 🤖**
