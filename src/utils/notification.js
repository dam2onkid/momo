/**
 * Notification utilities for sending messages to users
 */

/**
 * Sends a notification to a user about received tokens
 * @param {Object} bot - The Telegram bot instance
 * @param {string} telegramId - The Telegram ID of the user
 * @param {string} walletAddress - The wallet address that received tokens
 * @param {string} walletName - The name of the wallet
 * @param {string} tokenType - The type of token received (e.g., "APT", "Custom Token")
 * @param {string} tokenName - The name of the token
 * @param {string} amount - The amount of tokens received
 * @param {string} senderAddress - The address of the sender
 * @param {string} txnHash - The transaction hash
 */
const sendTokenReceivedNotification = async (
  bot,
  telegramId,
  walletAddress,
  walletName,
  tokenType,
  tokenName,
  amount,
  senderAddress,
  txnHash
) => {
  try {
    // Create an inline keyboard with actions the user can take
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "View Transaction",
            url: `https://explorer.aptoslabs.com/txn/${txnHash}`,
          },
          {
            text: "Check Balance",
            callback_data: "check_balance",
          },
        ],
      ],
    };

    // Format the notification message
    const message =
      `💰 *Token Received!*\n\n` +
      `You've received *${amount} ${tokenName}* (${tokenType}) in your wallet:\n` +
      `*${walletName}* (\`${walletAddress.substring(
        0,
        6
      )}...${walletAddress.substring(walletAddress.length - 4)}\`)\n\n` +
      `From: \`${senderAddress.substring(0, 6)}...${senderAddress.substring(
        senderAddress.length - 4
      )}\``;
    console.log(message);
    // Send the notification to the user
    await bot.api.sendMessage(telegramId, message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    console.log(`Notification sent to user ${telegramId} for received tokens`);
  } catch (error) {
    console.error(
      `Failed to send token notification to user ${telegramId}:`,
      error
    );
  }
};

export { sendTokenReceivedNotification };
