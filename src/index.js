import { Bot } from "grammy";
import dotenv from "dotenv";

import { command, wallet } from "./controllers/index.js";

// Load environment variables
dotenv.config();
const bot = new Bot(process.env.BOT_TOKEN);

// Handle commands
bot.command("start", command.start);
bot.command("wallets", wallet.listWallets);
bot.command("balance", wallet.getBalance);
// bot.command("import", wallet.importWallet);
// bot.command("setdefault", wallet.setDefaultWallet);

// Handle text messages and mentions
bot.on("message:text", command.handleTextMessage);

// Handle errors
bot.catch((err) => {
  console.error("Error in bot:", err);
});

// // Start the bot
console.log("Starting Momo Bot...");
bot.start();
