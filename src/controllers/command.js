import * as R from "remeda";

import { openai } from "../config/openai.js";
import { getOrCreateDefaultWallet } from "./wallet.js";
import { createOrUpdateUser } from "../models/telegramUser.js";

const errorHandler = async (err, ctx) => {
  console.error(`Error while handling update ${ctx.update.update_id}:`, err);

  const errorMessage =
    process.env.NODE_ENV === "development"
      ? `An error occurred: ${err.message}`
      : "An unexpected error occurred. Please try again later.";

  try {
    // Only send error message if we haven't replied yet
    if (!ctx.replied) {
      await ctx.reply(errorMessage);
    }
  } catch (e) {
    console.error("Error in error handler:", e);
  }
};

const start = async (ctx) => {
  const telegramId = ctx.from.id.toString();

  // Create or update user in database
  console.log(ctx.from);
  await createOrUpdateUser({
    telegram_id: telegramId,
    username: R.pathOr(ctx.from, ["username"], ""),
    name:
      R.pathOr(ctx.from, ["first_name"], "") +
      " " +
      R.pathOr(ctx.from, ["last_name"], ""),
  });

  // Get or create default wallet
  const wallet = await getOrCreateDefaultWallet(telegramId);
  await ctx.reply(
    `Welcome to Momo Bot! 👋\n\nI am your AI trading assistant for Aptos.\n\n` +
      `Your default wallet address: \`${wallet.address}\`\n\n` +
      `Available commands:\n` +
      `/wallet - Manage your wallets\n` +
      `/balance - Check wallet balance\n` +
      `/trade - Start trading`,
    { parse_mode: "Markdown" }
  );
};

const handleTextMessage = async (ctx) => {
  try {
    const message = ctx.message.text;
    const botUsername = ctx.me.username;
    const isMentioned = message.includes(`@${botUsername}`);
    const isGroupChat = ctx.chat.type !== "private";

    // Handle mentions in group chats
    if (isGroupChat && isMentioned) {
      // Remove bot mention from message
      const cleanMessage = message.replace(`@${botUsername}`, "").trim();

      // If message is empty after removing mention, send default response
      if (!cleanMessage) {
        await ctx.reply(`Hi @${ctx.from.username}! How can I help you today?`, {
          reply_to_message_id: ctx.message.message_id,
        });
        return;
      }

      // Process the message with AI
      // const aiResponse = await openai.invoke(cleanMessage);
      // await ctx.reply(aiResponse.content);
      return;
    }

    // Handle direct messages (private chat)
    if (!isGroupChat) {
      // const aiResponse = await openai.invoke(message);
      // await ctx.reply(aiResponse.content);
    }
  } catch (error) {
    console.error("Error handling message:", error);
    await ctx.reply("Sorry, there was an error processing your message.");
  }
};

export { start, handleTextMessage, errorHandler };
