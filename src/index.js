import { Bot, session } from "grammy";
import dotenv from "dotenv";
import { limit } from "@grammyjs/ratelimiter";

import { command, wallet } from "./controllers/index.js";
// import { initTokenMonitoring } from "./utils/tokenMonitor.js";

// Load environment variables
dotenv.config();
const bot = new Bot(process.env.BOT_TOKEN);

bot.use(
  limit({
    timeFrame: 1000,
    limit: 1,
    onLimitExceeded: (ctx) => {
      ctx.reply("⏳ Please slow down! You are sending too many requests.");
    },
  })
);

// Initialize session middleware
bot.use(
  session({
    initial: () => ({
      renameWallet: null,
      importWallet: null,
    }),
  })
);

// Handle commands
bot.command("start", command.start);
bot.command("wallet", wallet.getWallets);

// Handle text messages and mentions
bot.on("message:text", async (ctx, next) => {
  // Check if this is a rename wallet message
  if (await wallet.handleRenameMessage(ctx)) {
    return;
  }

  // Check if this is an import wallet message
  // FIXME: This is causing issues with the bot
  // if (await wallet.handleImportMessage(ctx)) {
  //   return;
  // }

  // If not a special message, proceed with normal message handling
  await command.handleTextMessage(ctx);
});

// Handle all wallet-related callbacks
bot.on("callback_query", wallet.handleCallbackQuery);

// Handle errors
bot.catch((err) => {
  console.error("Error in bot:", err);
});

// Start the bot
console.log("Starting Momo Bot...");
bot.start();

// Initialize token monitoring (will run in the background)
// FIXME: It doesn't work, fix later
// initTokenMonitoring(bot).catch((err) => {
//   console.error("Failed to initialize token monitoring:", err);
// });
