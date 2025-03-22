import * as R from "remeda";
import { HumanMessage } from "@langchain/core/messages";

import { getOrCreateDefaultWallet } from "./wallet.js";
import { createOrUpdateUser } from "../models/telegramUser.js";
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
    // const msg = await llm.invoke(message);
    // await ctx.reply(msg.content);
    // return;
    // const isMentioned = message.includes(`@${botUsername}`);
    // const isGroupChat = ctx.chat.type !== "private";
    const wallet = await getOrCreateDefaultWallet(ctx.from.id.toString());
    const { agent, config } = await initializeAgent(wallet);

    // Handle mentions in group chats
    const cleanMessage = message.replace(`@${botUsername}`, "").trim();
    if (!cleanMessage) {
      await ctx.reply(`Hi @${ctx.from.username}! How can I help you today?`, {
        reply_to_message_id: ctx.message.message_id,
      });
      return;
    }

    const stream = await agent.stream(
      { messages: [new HumanMessage(ctx.message?.text || "")] },
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

      await ctx.reply(responseText);
    }
  } catch (error) {
    console.error("Error handling message:", error);
    await ctx.reply("Sorry, there was an error processing your message.");
  }
};

export { start, handleTextMessage, errorHandler };
