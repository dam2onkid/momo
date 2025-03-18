import { Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { createWallet, getUserWallets } from "../config/database.js";

export async function generateAptosWallet(telegramId, walletName = "default") {
  try {
    // Generate new private key
    const privateKey = new Ed25519PrivateKey();

    // Get public key and address
    const publicKey = privateKey.publicKey();
    const address = publicKey.toAddress();

    // Save wallet to database
    const wallet = await createWallet({
      telegram_id: telegramId,
      wallet_name: walletName,
      private_key: privateKey.toHexString(),
      public_key: publicKey.toString(),
      address: address.toString(),
    });

    return wallet;
  } catch (error) {
    console.error("Error generating Aptos wallet:", error);
    throw error;
  }
}

export async function getOrCreateDefaultWallet(telegramId) {
  try {
    // Get user's wallets
    const wallets = await getUserWallets(telegramId);

    // If user has no wallets, create a default one
    if (!wallets || wallets.length === 0) {
      return await generateAptosWallet(telegramId, "default");
    }

    // Return the default wallet or the first available wallet
    return wallets.find((w) => w.wallet_name === "default") || wallets[0];
  } catch (error) {
    console.error("Error getting or creating default wallet:", error);
    throw error;
  }
}
