import { aptos } from "../config/aptos.js";
import { getUserWallets } from "../models/wallet.js";
import { sendTokenReceivedNotification } from "./notification.js";
import { supabase } from "../config/supabase.js";
import { TABLES } from "../models/const.js";

// Map to store the last checked sequence number for each address
const lastCheckedSequences = new Map();
// Cache of known active wallets to avoid checking inactive ones repeatedly
const activeWalletsCache = new Map();
// Monitoring interval in milliseconds
const A_SECOND = 1000;
const MONITORING_INTERVAL = 10 * A_SECOND; // Check every 10 seconds instead of 30

/**
 * Initialize token monitoring for all user wallets
 * @param {Object} bot - The Telegram bot instance
 */
const initTokenMonitoring = async (bot) => {
  console.log("Initializing token transfer monitoring...");

  // Set up periodic checking
  setInterval(async () => {
    try {
      await checkAllWalletsForTransfers(bot);
    } catch (error) {
      console.error("Error in token monitoring:", error);
    }
  }, MONITORING_INTERVAL);

  console.log(
    `Token monitoring initialized (checking every ${
      MONITORING_INTERVAL / 1000
    }s)`
  );
};

/**
 * Check all user wallets for new token transfers
 * @param {Object} bot - The Telegram bot instance
 */
const checkAllWalletsForTransfers = async (bot) => {
  try {
    // Get all unique telegram IDs from the database
    const { data: telegramUsers } = await getUniqueUserIds();

    // Process users in parallel with a concurrency limit
    const promises = telegramUsers.map((user) =>
      processUserWallets(bot, user.telegram_id)
    );

    // Wait for all promises to resolve
    await Promise.allSettled(promises);
  } catch (error) {
    console.error("Error checking wallets for transfers:", error);
  }
};

/**
 * Process all wallets for a specific user
 * @param {Object} bot - The Telegram bot instance
 * @param {string} telegramId - User's Telegram ID
 */
const processUserWallets = async (bot, telegramId) => {
  try {
    // Get all wallets for this user
    const wallets = await getUserWallets(telegramId);

    // Process each wallet sequentially to avoid rate limiting
    for (const wallet of wallets) {
      await checkWalletForTransfers(bot, telegramId, wallet);

      // Small delay between wallet checks to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error(`Error processing wallets for user ${telegramId}:`, error);
  }
};

/**
 * Get all unique telegram IDs from the database
 * @returns {Promise<Object>} - Object containing telegram_id data
 */
const getUniqueUserIds = async () => {
  try {
    const { data, error } = await supabase
      .from(TABLES.WALLETS)
      .select("telegram_id")
      .eq("deleted", false);

    if (error) throw error;

    // Filter to get unique telegram_ids
    const uniqueIds = Array.from(
      new Set(data.map((item) => item.telegram_id))
    ).map((id) => ({ telegram_id: id }));

    return { data: uniqueIds };
  } catch (error) {
    console.error("Error fetching unique user IDs:", error);
    return { data: [] };
  }
};

/**
 * Check a single wallet for new token transfers
 * @param {Object} bot - The Telegram bot instance
 * @param {string} telegramId - The Telegram ID of the user
 * @param {Object} wallet - The wallet to check
 */
const checkWalletForTransfers = async (bot, telegramId, wallet) => {
  try {
    const address = wallet.address;
    const walletName = wallet.wallet_name;

    // Skip wallets that we know aren't active on-chain yet
    // Re-check inactive wallets periodically (every hour)
    const cacheKey = `${telegramId}:${address}`;
    const cachedState = activeWalletsCache.get(cacheKey);
    const currentTime = Date.now();

    if (
      cachedState &&
      cachedState.active === false &&
      currentTime - cachedState.lastChecked < 3600000
    ) {
      return; // Skip this wallet for now
    }

    // Get the last checked sequence number for this address, or use 0 if not set
    const lastChecked = lastCheckedSequences.get(address) || 0;

    // Get all transactions for this address since the last check
    const transactions = await getRecentTransactions(address, lastChecked);
    console.log("transactions", transactions);

    // If we get a successful response (even empty), mark the wallet as active
    activeWalletsCache.set(cacheKey, {
      active: true,
      lastChecked: currentTime,
    });

    // No transactions means nothing to process
    if (!transactions || transactions.length === 0) return;

    // Filter for relevant token transfers (received tokens)
    const receivedTransfers = filterReceivedTransfers(transactions, address);

    // Update the last checked sequence number
    if (transactions.length > 0) {
      const highestSequence = Math.max(
        ...transactions.map((tx) => tx.sequence_number || 0)
      );
      lastCheckedSequences.set(address, highestSequence);
    }

    // Send notifications for each transfer
    for (const transfer of receivedTransfers) {
      await sendTokenReceivedNotification(
        bot,
        telegramId,
        address,
        walletName,
        transfer.tokenType,
        transfer.tokenName,
        transfer.amount,
        transfer.senderAddress,
        transfer.txnHash
      );
    }
  } catch (error) {
    // Handle 404 errors for accounts not found - these are expected for new wallets
    if (
      error.status === 404 &&
      error.data?.error_code === "account_not_found"
    ) {
      const cacheKey = `${telegramId}:${wallet.address}`;
      activeWalletsCache.set(cacheKey, {
        active: false,
        lastChecked: Date.now(),
      });
    } else {
      console.error(
        `Error checking wallet ${wallet.address} for transfers:`,
        error.message || error
      );
    }
  }
};

/**
 * Get recent transactions for an address
 * @param {string} address - The wallet address
 * @param {number} fromSequence - The sequence number to start from
 * @returns {Array} - Array of transaction objects
 */
const getRecentTransactions = async (address, fromSequence) => {
  try {
    // Fetch transactions for the account
    const transactions = await aptos.getAccountTransactions({
      accountAddress: address,
      start: fromSequence,
      limit: 25, // Adjust as needed
    });

    return transactions;
  } catch (error) {
    // Let the caller handle the error
    throw error;
  }
};

/**
 * Filter transactions for received token transfers
 * @param {Array} transactions - The transactions to filter
 * @param {string} address - The wallet address
 * @returns {Array} - Array of filtered and formatted transfers
 */
const filterReceivedTransfers = (transactions, address) => {
  const receivedTransfers = [];

  for (const tx of transactions) {
    try {
      // Skip failed transactions
      if (tx.vm_status !== "Executed successfully") continue;

      // Check for coin transfer events (changes based on Aptos event structure)
      const events = tx.events || [];

      for (const event of events) {
        // Check if this is a deposit event where the receiver is our address
        if (
          event.type?.includes("0x1::coin::DepositEvent") &&
          event.data?.to?.toLowerCase() === address.toLowerCase()
        ) {
          // Extract token information
          const tokenType = extractTokenType(event.type);
          const amount = event.data.amount;

          receivedTransfers.push({
            tokenType: tokenType,
            tokenName: getTokenName(tokenType),
            amount: formatAmount(amount, tokenType),
            senderAddress: tx.sender,
            txnHash: tx.hash,
          });
        }
      }
    } catch (error) {
      console.error("Error processing transaction:", error);
    }
  }

  return receivedTransfers;
};

/**
 * Extract the token type from the event type
 * @param {string} eventType - The event type string
 * @returns {string} - The token type
 */
const extractTokenType = (eventType) => {
  try {
    // Example: "0x1::coin::DepositEvent<0x1::aptos_coin::AptosCoin>"
    const match = eventType.match(/<(.+)>/);
    return match ? match[1] : "Unknown";
  } catch (error) {
    return "Unknown";
  }
};

/**
 * Get a friendly token name from the token type
 * @param {string} tokenType - The token type
 * @returns {string} - The token name
 */
const getTokenName = (tokenType) => {
  // Map common token types to friendly names
  if (tokenType.includes("aptos_coin::AptosCoin")) {
    return "APT";
  }
  // Add more token mappings as needed
  return "Token";
};

/**
 * Format the token amount for display
 * @param {string} amount - The raw amount
 * @param {string} tokenType - The token type
 * @returns {string} - The formatted amount
 */
const formatAmount = (amount, tokenType) => {
  try {
    const numAmount = parseInt(amount);
    if (isNaN(numAmount)) return "0.00";

    // Different tokens have different decimal places
    let decimals = 8; // Default for APT

    if (tokenType.includes("aptos_coin::AptosCoin")) {
      decimals = 8;
    }
    // Add more token decimals as needed

    return (numAmount / Math.pow(10, decimals)).toFixed(6);
  } catch (error) {
    console.error("Error formatting amount:", error);
    return "0.00";
  }
};

export { initTokenMonitoring };
