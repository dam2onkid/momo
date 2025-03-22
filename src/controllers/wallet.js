import { Account, SigningSchemeInput } from "@aptos-labs/ts-sdk";

import {
  createWallet,
  getUserWallets,
  getWalletByName,
  updateWalletStatus,
  updateWalletName,
  deleteWallet,
} from "../models/wallet.js";
import { getAgentRuntime } from "./agent.js";
import { aptos, getSignerAndAccount } from "../config/aptos.js";

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

const generateAptosWallet = async (
  telegramId,
  walletName,
  isDefault = false
) => {
  try {
    const AptosAccount = Account.generate({
      scheme: SigningSchemeInput.Ed25519,
    });

    walletName =
      walletName ||
      `${AptosAccount.accountAddress
        .toString()
        .substring(0, 5)}...${AptosAccount.accountAddress
        .toString()
        .substring(AptosAccount.accountAddress.toString().length - 5)}`;

    const wallet = await createWallet({
      telegram_id: telegramId,
      wallet_name: walletName,
      private_key: AptosAccount.privateKey.toString(),
      public_key: AptosAccount.publicKey.toString(),
      address: AptosAccount.accountAddress.toString(),
      is_default: isDefault,
    });

    return wallet;
  } catch (error) {
    console.error("Error generating Aptos wallet:", error);
    throw error;
  }
};

const getOrCreateDefaultWallet = async (telegramId, walletName) => {
  try {
    const wallets = await getUserWallets(telegramId);
    if (!wallets || wallets.length === 0) {
      return await generateAptosWallet(telegramId, walletName);
    }

    const wallet = wallets.find((w) => w.is_default) || wallets[0];
    return wallet;
  } catch (error) {
    console.error("Error getting or creating default wallet:", error);
    throw error;
  }
};

const getBalance = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const wallet = await getOrCreateDefaultWallet(telegramId);
    const agentRuntime = await getAgentRuntime(wallet.private_key);
    const balance = await agentRuntime.getBalance();

    // Create inline keyboard with actions
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔑 Create New Wallet", callback_data: "create_wallet" },
          { text: "📥 Import Wallet", callback_data: "import_wallet_start" },
        ],
      ],
    };

    await ctx.reply(
      `💰 Your balance is ${balance} APT.\n` +
        `📝 Wallet: \`${wallet.address}\``,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    console.error("Error getting balance:", error);

    // If no wallet, show options to create or import
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔑 Create New Wallet", callback_data: "create_wallet" },
          { text: "📥 Import Wallet", callback_data: "import_wallet_start" },
        ],
      ],
    };

    await ctx.reply(
      "You don't have any wallets yet. Would you like to create a new wallet or import an existing one?",
      { reply_markup: keyboard }
    );
  }
};

const getWallets = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const wallets = await getUserWallets(telegramId);

    // Create inline keyboard with wallet buttons
    const walletButtons = wallets.map((wallet) => [
      {
        text: `${wallet.wallet_name}${wallet.is_default ? " ✅" : ""}`,
        callback_data: `wallet_${wallet.wallet_name}`,
      },
    ]);

    // Add create and import buttons at the bottom
    const actionButtons = [
      [
        { text: "➕ Create Wallet", callback_data: "create_wallet" },
        { text: "📥 Import Wallet", callback_data: "import_wallet_start" },
      ],
    ];

    await ctx.reply(`📒 Wallets (${wallets.length})`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [...walletButtons, ...actionButtons] },
    });
  } catch (error) {
    console.error("Error listing wallets:", error);

    // If error or no wallets, show only create and import buttons
    const keyboard = [
      [
        { text: "➕ Create Wallet", callback_data: "create_wallet" },
        { text: "📥 Import Wallet", callback_data: "import_wallet_start" },
      ],
    ];

    await ctx.reply(`📒 Wallets (0)`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  }
};

const handleWalletSelectionCallback = async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("wallet_")) return;

    const walletName = data.replace("wallet_", "");
    const telegramId = ctx.from.id.toString();

    const wallet = await getWalletByName(telegramId, walletName);
    if (!wallet) {
      await ctx.reply(`Wallet "${walletName}" not found.`);
      return;
    }

    // Get balance
    const agentRuntime = await getAgentRuntime(wallet.private_key);
    const balance = await agentRuntime.getBalance();

    // Set default button text based on current status
    const defaultBtnText = wallet.is_default
      ? "✅ Default Wallet"
      : "⭐ Set as Default";

    // Create inline keyboard with actions
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `🏷 Name: ${walletName}`,
            callback_data: `rename_${walletName}`,
          },
        ],
        [
          {
            text: defaultBtnText,
            callback_data: `toggle_default_${walletName}`,
          },
        ],
        [
          {
            text: "💸 Withdraw APT",
            callback_data: `withdraw_APT_${walletName}`,
          },
          {
            text: "🔄 Withdraw Tokens",
            callback_data: `withdraw_tokens_${walletName}`,
          },
        ],
        [
          { text: "❌ Delete", callback_data: `delete_${walletName}` },
          { text: "← Back", callback_data: "back_to_wallets" },
        ],
      ],
    };

    // Update the message with wallet details
    await ctx.editMessageText(
      `💰 Balance: ${balance} APT\n` +
        `📝 Wallet:\n` +
        `\`${wallet.address}\`\n\n` +
        `🔑 Private Key:\n` +
        `\`${wallet.private_key}\``,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    console.error("Error handling wallet selection:", error);
    await ctx.reply("Failed to load wallet details. Please try again.");
  }
};

// Add handler for toggling default wallet status
const handleToggleDefaultWallet = async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const walletName = data.replace("toggle_default_", "");
    const telegramId = ctx.from.id.toString();

    const wallet = await getWalletByName(telegramId, walletName);
    if (!wallet) {
      await ctx.reply(`Wallet "${walletName}" not found.`);
      return;
    }

    // If already default, do nothing (we don't allow "un-defaulting" a wallet)
    if (wallet.is_default) {
      await ctx.answerCallbackQuery({
        text: "This is already your default wallet",
        show_alert: true,
      });
      return;
    }

    // Toggle default status
    await updateWalletStatus(telegramId, walletName, true);

    // Get updated wallet with balance
    const updatedWallet = await getWalletByName(telegramId, walletName);
    const agentRuntime = await getAgentRuntime(updatedWallet.private_key);
    const balance = await agentRuntime.getBalance();

    // Set default button text based on new status
    const defaultBtnText = "✅ Default Wallet";

    // Create updated inline keyboard
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `🏷 Name: ${walletName}`,
            callback_data: `rename_${walletName}`,
          },
        ],
        [
          {
            text: defaultBtnText,
            callback_data: `toggle_default_${walletName}`,
          },
        ],
        [
          {
            text: "💸 Withdraw APT",
            callback_data: `withdraw_APT_${walletName}`,
          },
          {
            text: "🔄 Withdraw Tokens",
            callback_data: `withdraw_tokens_${walletName}`,
          },
        ],
        [
          { text: "❌ Delete", callback_data: `delete_${walletName}` },
          { text: "← Back", callback_data: "back_to_wallets" },
        ],
      ],
    };

    // Update the message with updated wallet details
    await ctx.editMessageText(
      `✅ Set as default wallet!\n\n` +
        `💰 Balance: ${balance} APT\n` +
        `📝 Wallet:\n` +
        `\`${updatedWallet.address}\``,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    console.error("Error toggling default wallet:", error);
    await ctx.reply("Failed to set default wallet. Please try again.");
  }
};

const handleWithdrawAPT = async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const walletName = data.replace("withdraw_APT_", "");
    await ctx.reply(
      `Withdraw APT functionality for ${walletName} coming soon!`
    );
  } catch (error) {
    console.error("Error handling APT withdrawal:", error);
    await ctx.reply("Failed to process withdrawal. Please try again.");
  }
};

const handleWithdrawTokens = async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const walletName = data.replace("withdraw_tokens_", "");
    await ctx.reply(
      `Withdraw tokens functionality for ${walletName} coming soon!`
    );
  } catch (error) {
    console.error("Error handling token withdrawal:", error);
    await ctx.reply("Failed to process withdrawal. Please try again.");
  }
};

const handleDeleteWallet = async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const walletName = data.replace("delete_", "");
    const telegramId = ctx.from.id.toString();

    await deleteWallet(telegramId, walletName);
    await Promise.all([
      ctx.reply(`Wallet "${walletName}" deleted successfully.`),
      handleBackToWallets(ctx),
    ]);
  } catch (error) {
    console.error("Error handling wallet deletion:", error);
    await ctx.reply("Failed to delete wallet. Please try again.");
  }
};

const handleBackToWallets = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const wallets = await getUserWallets(telegramId);

    // Create inline keyboard with wallet buttons
    const walletButtons = wallets.map((wallet) => [
      {
        text: `${wallet.wallet_name}${wallet.is_default ? " ✅" : ""}`,
        callback_data: `wallet_${wallet.wallet_name}`,
      },
    ]);

    // Add create and import buttons at the bottom
    const actionButtons = [
      [
        { text: "➕ Create Wallet", callback_data: "create_wallet" },
        { text: "📥 Import Wallet", callback_data: "import_wallet_start" },
      ],
    ];

    // Combine all buttons
    const keyboard = [...walletButtons, ...actionButtons];

    await ctx.editMessageText(`📒 Wallets (${wallets.length})`, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    console.error("Error returning to wallet list:", error);
    await ctx.reply("Failed to load wallet list. Please try again.");
  }
};

// Add new handler for rename functionality
const handleRenameWallet = async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const oldWalletName = data.replace("rename_", "");
    const telegramId = ctx.from.id.toString();

    // Store the wallet being renamed in temporary state
    ctx.session = {
      ...ctx.session,
      renameWallet: {
        oldName: oldWalletName,
        telegramId: telegramId,
        isRenaming: true,
      },
    };

    await ctx.reply(
      "Please enter the new name for your wallet.\n" +
        "Requirements:\n" +
        "- Maximum 20 characters\n" +
        "- Only letters, numbers, and underscores\n" +
        "- Must be unique among your wallets"
    );
  } catch (error) {
    console.error("Error initiating wallet rename:", error);
    await ctx.reply("Failed to initiate rename. Please try again.");
  }
};

// Add handler for processing the new wallet name
const handleRenameMessage = async (ctx) => {
  try {
    // Check if we're in renaming mode
    if (!ctx.session?.renameWallet?.isRenaming) {
      return false;
    }

    const newName = ctx.message.text.trim();
    const { oldName, telegramId } = ctx.session.renameWallet;

    // Validate new name
    if (!/^[a-zA-Z0-9_]{1,20}$/.test(newName)) {
      await ctx.reply(
        "Invalid wallet name. Please use only letters, numbers, and underscores (max 20 characters)."
      );
      return true;
    }

    // Check if name is already taken
    const existingWallets = await getUserWallets(telegramId);
    if (existingWallets.some((w) => w.wallet_name === newName)) {
      await ctx.reply(
        "This wallet name is already taken. Please choose a different name."
      );
      return true;
    }

    // Get the wallet to check if it's default
    const oldWallet = await getWalletByName(telegramId, oldName);
    const isDefault = oldWallet.is_default;

    // Update wallet name
    await updateWalletName(telegramId, oldName, newName);

    // Clear renaming state
    ctx.session.renameWallet = null;

    // Show updated wallet details
    const wallet = await getWalletByName(telegramId, newName);
    const agentRuntime = await getAgentRuntime(wallet.private_key);
    const balance = await agentRuntime.getBalance();

    // Set default button text based on wallet status
    const defaultBtnText = isDefault
      ? "✅ Default Wallet"
      : "⭐ Set as Default";

    const keyboard = {
      inline_keyboard: [
        [{ text: `🏷 Name: ${newName}`, callback_data: `rename_${newName}` }],
        [{ text: defaultBtnText, callback_data: `toggle_default_${newName}` }],
        [
          { text: "💸 Withdraw APT", callback_data: `withdraw_APT_${newName}` },
          {
            text: "🔄 Withdraw Tokens",
            callback_data: `withdraw_tokens_${newName}`,
          },
        ],
        [
          { text: "❌ Delete", callback_data: `delete_${newName}` },
          { text: "← Back", callback_data: "back_to_wallets" },
        ],
      ],
    };

    await ctx.reply(
      `✅ Wallet renamed successfully!\n\n` +
        `💰 Balance: ${balance} APT\n` +
        `📝 Wallet:\n` +
        `\`${wallet.address}\``,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );

    return true;
  } catch (error) {
    console.error("Error processing wallet rename:", error);
    await ctx.reply("Failed to rename wallet. Please try again.");
    return true;
  }
};

// Add handlers for wallet creation and import
const handleCreateWallet = async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const wallets = await getUserWallets(telegramId);
    const wallet = await generateAptosWallet(
      telegramId,
      null,
      wallets.length === 0 // Set as default if it's the first wallet
    );

    // Send wallet details
    await ctx.editMessageText(
      `✅ Generated new wallet:\n\n` +
        `Address:\n` +
        `\`${wallet.address}\`\n\n` +
        `PK:\n` +
        `\`${wallet.private_key}\`\n\n` +
        `⚠️ Make sure to save this seed phrase using pen and paper only. Do NOT copy-paste it anywhere. You could also import it to your wallet. After you finish saving/importing the wallet credentials, delete this message. The next will display the information.`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "← Back", callback_data: "back_to_wallets" }],
          ],
        },
      }
    );
  } catch (error) {
    console.error("Error creating wallet:", error);
    await ctx.editMessageText("Failed to create wallet. Please try again.");
  }
};

// Modify import wallet handler to match the image
const handleImportWalletStart = async (ctx) => {
  try {
    // Store in session that we're waiting for seed phrase or private key
    ctx.session = {
      ...ctx.session,
      importWallet: {
        type: "any",
        isImporting: true,
      },
    };

    // Send a separate message to instruct the user
    await ctx.reply("Support for importing wallets coming soon!");
    // await ctx.reply(
    //   "Please send your mnemonic phrase or private key as a direct message."
    // );
  } catch (error) {
    console.error("Error starting wallet import:", error);
    await ctx.reply("Failed to start import process. Please try again.");
  }
};

// Update handler for processing import message to handle both types automatically
const handleImportMessage = async (ctx) => {
  try {
    // TASK: do not work with this function
    // Check if we're in importing mode
    if (!ctx.session?.importWallet?.isImporting) {
      return false;
    }

    const input = ctx.message.text.trim();
    const telegramId = ctx.from.id.toString();

    // Generate a random wallet name
    const walletName = `wallet_${Math.floor(Math.random() * 10000)}`;

    // Determine input type (seed phrase or private key)
    const inputType = input.includes(" ") ? "seed" : "private_key";

    if (inputType === "private_key") {
      // Validate private key
      const inputPrivateKey = PrivateKey.formatPrivateKey(
        input,
        PrivateKeyVariants.Ed25519
      );
      // if (!validatePrivateKey(inputPrivateKey)) {
      //   await ctx.reply(
      //     "Invalid private key format. Please provide a valid 64-character hex string."
      //   );
      //   return true;
      // }

      // Import wallet with private key
      const privateKey = new Ed25519PrivateKey(inputPrivateKey);
      console.log("privateKey", privateKey);
      const account = Account.fromPrivateKey(privateKey);
      console.log("account", account);
      const publicKey = account.publicKey;
      const address = account.accountAddress;

      // Check if wallet already exists
      const existingWallets = await getUserWallets(telegramId);
      const existingWallet = existingWallets.find(
        (w) => w.address === address.toString()
      );

      if (existingWallet) {
        await ctx.reply(
          `This wallet already exists with name: ${existingWallet.wallet_name}`
        );
        ctx.session.importWallet = null;
        return true;
      }

      // Create new wallet
      const wallet = await createWallet({
        telegram_id: telegramId,
        wallet_name: walletName,
        private_key: input,
        public_key: publicKey.toString(),
        address: address.toString(),
      });

      // If this is the first wallet, set it as default
      if (existingWallets.length === 0) {
        await updateWalletStatus(telegramId, walletName, true);
      }

      // Clear import state
      ctx.session.importWallet = null;

      await ctx.reply(
        `✅ Wallet imported successfully!\n\n` +
          `Name: ${walletName}\n` +
          `Address: \`${address.toString()}\`\n\n` +
          `Use /wallets to see all your wallets.`,
        { parse_mode: "Markdown" }
      );
    } else if (inputType === "seed") {
      // Import using seed phrase
      try {
        // Derive account from mnemonic
        const account = await aptos.deriveAccountFromMnemonic({
          mnemonic: input,
        });

        const address = account.accountAddress.toString();

        // Check if wallet already exists
        const existingWallets = await getUserWallets(telegramId);
        const existingWallet = existingWallets.find(
          (w) => w.address === address
        );

        if (existingWallet) {
          await ctx.reply(
            `This wallet already exists with name: ${existingWallet.wallet_name}`
          );
          ctx.session.importWallet = null;
          return true;
        }

        // Create new wallet
        const wallet = await createWallet({
          telegram_id: telegramId,
          wallet_name: walletName,
          private_key: account.privateKey.toString(),
          public_key: account.publicKey.toString(),
          address: address,
        });

        // If this is the first wallet, set it as default
        if (existingWallets.length === 0) {
          await updateWalletStatus(telegramId, walletName, true);
        }

        // Clear import state
        ctx.session.importWallet = null;

        await ctx.reply(
          `✅ Wallet imported successfully!\n\n` +
            `Name: ${walletName}\n` +
            `Address: \`${address}\`\n\n` +
            `Use /wallets to see all your wallets.`,
          { parse_mode: "Markdown" }
        );
      } catch (error) {
        console.error("Error importing from seed phrase:", error);
        await ctx.reply("Invalid seed phrase. Please check and try again.");
      }
    }

    return true;
  } catch (error) {
    console.error("Error processing wallet import:", error);
    await ctx.reply("Failed to import wallet. Please try again.");
    // Clear import state
    ctx.session.importWallet = null;
    return true;
  }
};

// Update handleCallbackQuery to include new handlers
const handleCallbackQuery = async (ctx) => {
  const data = ctx.callbackQuery.data;

  // Define a mapping of callback prefixes to their handler functions
  const callbackHandlers = {
    wallet_: handleWalletSelectionCallback,
    withdraw_APT_: handleWithdrawAPT,
    withdraw_tokens_: handleWithdrawTokens,
    delete_: handleDeleteWallet,
    rename_: handleRenameWallet,
    toggle_default_: handleToggleDefaultWallet,
    create_wallet: handleCreateWallet,
    import_wallet_start: handleImportWalletStart,
    back_to_wallets: handleBackToWallets,
  };

  // Find the matching handler based on the callback data prefix
  const handler = Object.entries(callbackHandlers).find(
    ([prefix, _]) =>
      prefix === data ||
      (prefix !== "back_to_wallets" &&
        prefix !== "create_wallet" &&
        prefix !== "import_wallet_start" &&
        data.startsWith(prefix))
  );

  // Execute the handler if found
  if (handler) {
    await handler[1](ctx);
  }
};

export {
  generateAptosWallet,
  getOrCreateDefaultWallet,
  getSignerAndAccount,
  getBalance,
  getWallets,
  handleCallbackQuery,
};
