import * as R from "remeda";
import { HumanMessage } from "@langchain/core/messages";

import { getOrCreateDefaultWallet } from "./wallet.js";
import {
  createOrUpdateUser,
  getUserByUsername,
  findUserByIdentifier,
} from "../models/telegramUser.js";
import { initializeAgent } from "./agent.js";

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
  await createOrUpdateUser({
    telegram_id: telegramId,
    username: R.pathOr(ctx.from, ["username"], ""),
    first_name: R.pathOr(ctx.from, ["first_name"], ""),
    last_name: R.pathOr(ctx.from, ["last_name"], ""),
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

    if (isGroupChat && !isMentioned) return;

    const telegramId = ctx.from.id.toString();
    const wallet = await getOrCreateDefaultWallet(telegramId);

    let cleanMessage = message.replace(`@${botUsername}`, "").trim();

    // If just mentioned with no text, send a greeting
    if (!cleanMessage) {
      await ctx.reply(`Hi @${ctx.from.username}! How can I help you today?`, {
        reply_to_message_id: ctx.message.message_id,
      });
      return;
    }

    // Process user mentions or user identifiers
    // Match any username mention pattern: @username
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = cleanMessage.match(mentionRegex);

    if (mentions && mentions.length > 0) {
      // Track processed message for display to user
      let processedMessage = cleanMessage;
      let replacementsMade = false;

      // Process each mention
      const totalMentions = mentions.length;
      let currentMention = 0;
      for (const mention of mentions) {
        currentMention++;
        const username = mention.substring(1); // Remove @ symbol

        try {
          // Look up user by username or any identifier
          const userRecord = await findUserByIdentifier(username);

          if (userRecord) {
            // User exists, get their wallet
            const userWallet = await getOrCreateDefaultWallet(
              userRecord.telegram_id
            );
            processedMessage = processedMessage.replace(
              mention,
              userWallet.address
            );
            cleanMessage = cleanMessage.replace(mention, userWallet.address);
            replacementsMade = true;
          } else {
            // User doesn't exist in our system
            await ctx.reply(
              `User ${mention} not found in our system. They need to start the bot first.`
            );
          }
        } catch (error) {
          console.error(`Error processing mention ${mention}:`, error);
        }
      }

      if (currentMention === 0) {
        await ctx.reply(`Can't process: ${processedMessage}`, {
          reply_to_message_id: ctx.message.message_id,
        });
      }
    }

    const { agent, config } = await initializeAgent(wallet);

    console.log(
      "Processing message:",
      cleanMessage,
      "from user ID:",
      ctx.from.id
    );

    const stream = await agent.stream(
      { messages: [new HumanMessage(cleanMessage)] },
      config
    );

    for await (const chunk of stream) {
      if (!("agent" in chunk) || !chunk.agent.messages[0]?.content) continue;

      const messageContent = chunk.agent.messages[0].content;
      let responseText = "";

      if (Array.isArray(messageContent)) {
        responseText =
          messageContent
            .filter((msg) => msg.type === "text")
            .map((msg) => msg.text)
            .join("\n\n") || "No text response available.";
      } else if (typeof messageContent === "object") {
        responseText = JSON.stringify(messageContent, null, 2);
      } else {
        responseText = String(messageContent);
      }

      await ctx.reply(responseText, {
        reply_to_message_id: ctx.message.message_id,
      });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    await ctx.reply("Sorry, there was an error processing your message.");
  }
};

export { start, handleTextMessage, errorHandler };
