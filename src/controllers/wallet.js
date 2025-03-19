import { Ed25519PrivateKey, Account } from "@aptos-labs/ts-sdk";
import { LocalSigner } from "move-agent-kit";

import {
  createWallet,
  getUserWallets,
  updateWalletStatus,
} from "../models/wallet.js";

const validatePrivateKey = (privateKey) => {
  try {
    const cleanKey = privateKey.trim();

    if (!cleanKey.match(/^[0-9a-fA-F]{64}$/)) {
      return null;
    }
    return cleanKey;
  } catch (error) {
    return null;
  }
};

const generateAptosWallet = async (telegramId, walletName = "default") => {
  try {
    // // Generate new private key
    // const privateKey = new Ed25519PrivateKey();

    // // Get public key and address
    // const publicKey = privateKey.publicKey();
    // const address = publicKey.toAddress();

    const AptosAccount = Account.generate();
    console.log(AptosAccount);

    // Save wallet to database
    const wallet = await createWallet({
      telegram_id: telegramId,
      wallet_name: walletName,
      private_key: AptosAccount.privateKey.toString(),
      public_key: AptosAccount.publicKey.toString(),
      address: AptosAccount.accountAddress.toString(),
    });

    return wallet;
  } catch (error) {
    console.error("Error generating Aptos wallet:", error);
    throw error;
  }
};

const getOrCreateDefaultWallet = async (telegramId, walletName = "default") => {
  try {
    console.log("getOrCreateDefaultWallet", telegramId, walletName);
    // Get user's wallets
    const wallets = await getUserWallets(telegramId);
    console.log(wallets);

    // If user has no wallets, create a default one
    if (!wallets || wallets.length === 0) {
      return await generateAptosWallet(telegramId, walletName);
    }

    // Return the default wallet or the first available wallet
    return wallets.find((w) => w.is_default) || wallets[0];
  } catch (error) {
    console.error("Error getting or creating default wallet:", error);
    throw error;
  }
};

const getSignerByTelegramId = async (telegramId) => {
  const wallet = await getOrCreateDefaultWallet(telegramId);
  const account = await aptos.deriveAccountFromPrivateKey({
    privateKey: new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(
        process.env.PRIVATE_KEY,
        PrivateKeyVariants.Ed25519
      )
    ),
  });

  const signer = new LocalSigner(account, Network.MAINNET);
  return signer;
};

const importWallet = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const message = ctx.message.text;
    const botUsername = ctx.me.username;
    const isMentioned = message.includes(`@${botUsername}`);
    const isGroupChat = ctx.chat.type !== "private";

    // Only process in private chat or when mentioned in group
    if (isGroupChat && !isMentioned) return;

    // Extract private key from message
    // Expected format: /import <private_key> <wallet_name>
    const parts = message.split(" ");
    if (parts.length < 3) {
      await ctx.reply(
        "Please provide the private key and wallet name.\n" +
          "Format: /import <private_key> <wallet_name>"
      );
      return;
    }

    const privateKeyHex = parts[1];
    const walletName = parts[2];

    // Validate private key format
    if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
      await ctx.reply(
        "Invalid private key format. Please provide a valid 64-character hex string."
      );
      return;
    }

    // Create Aptos private key from hex
    const privateKey = new Ed25519PrivateKey(privateKeyHex);
    const publicKey = privateKey.publicKey();
    const address = publicKey.toAddress();

    // Check if wallet name already exists
    const existingWallets = await getUserWallets(telegramId);
    const existingWallet = existingWallets.find(
      (w) => w.wallet_name === walletName
    );

    if (existingWallet) {
      await ctx.reply(
        `A wallet with name "${walletName}" already exists. Please choose a different name.`
      );
      return;
    }

    // Create new wallet
    const wallet = await createWallet({
      telegram_id: telegramId,
      wallet_name: walletName,
      private_key: privateKeyHex,
      public_key: publicKey.toString(),
      address: address.toString(),
    });

    // If this is the first wallet, set it as default
    if (existingWallets.length === 0) {
      await updateWalletStatus(telegramId, walletName, true);
    }

    await ctx.reply(
      `✅ Wallet imported successfully!\n\n` +
        `Name: ${walletName}\n` +
        `Address: \`${address.toString()}\`\n\n` +
        `Use /wallet list to see all your wallets.`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error importing wallet:", error);
    await ctx.reply(
      "Failed to import wallet. Please check the private key and try again."
    );
  }
};

const setDefaultWallet = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const message = ctx.message.text;
    const botUsername = ctx.me.username;
    const isMentioned = message.includes(`@${botUsername}`);
    const isGroupChat = ctx.chat.type !== "private";

    // Only process in private chat or when mentioned in group
    if (isGroupChat && !isMentioned) return;

    // Extract wallet name from message
    // Expected format: /setdefault <wallet_name>
    const parts = message.split(" ");
    if (parts.length < 2) {
      await ctx.reply(
        "Please provide the wallet name.\n" +
          "Format: /setdefault <wallet_name>"
      );
      return;
    }

    const walletName = parts[1];

    // Get user's wallets
    const wallets = await getUserWallets(telegramId);
    const targetWallet = wallets.find((w) => w.wallet_name === walletName);

    if (!targetWallet) {
      await ctx.reply(
        `Wallet "${walletName}" not found. Use /wallet list to see your wallets.`
      );
      return;
    }

    // Update default wallet status
    await updateWalletStatus(telegramId, walletName, true);

    await ctx.reply(
      `✅ Default wallet updated!\n\n` +
        `New default wallet: ${walletName}\n` +
        `Address: \`${targetWallet.address}\``,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error setting default wallet:", error);
    await ctx.reply("Failed to set default wallet. Please try again.");
  }
};

export {
  generateAptosWallet,
  getOrCreateDefaultWallet,
  getSignerByTelegramId,
  importWallet,
  setDefaultWallet,
};
