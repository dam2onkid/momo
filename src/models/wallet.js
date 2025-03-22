import { TABLES } from "./const.js";
import { supabase } from "../config/supabase.js";
import { decrypt, encrypt } from "../utils/encrypt.js";

// Wallet operations
const createWallet = async (walletData) => {
  const { data, error } = await supabase
    .from(TABLES.WALLETS)
    .insert({
      telegram_id: walletData.telegram_id,
      wallet_name: walletData.wallet_name,
      private_key: encrypt(walletData.private_key),
      public_key: encrypt(walletData.public_key),
      address: encrypt(walletData.address),
      is_default: walletData.is_default || false,
    })
    .select();

  if (error) throw error;
  data[0].private_key = decrypt(data[0].private_key);
  data[0].public_key = decrypt(data[0].public_key);
  data[0].address = decrypt(data[0].address);
  return data[0];
};

const getUserWallets = async (telegramId) => {
  const { data, error } = await supabase
    .from(TABLES.WALLETS)
    .select("*")
    .eq("telegram_id", telegramId)
    .eq("deleted", false);

  if (error) throw error;
  data.forEach((wallet) => {
    wallet.private_key = decrypt(wallet.private_key);
    wallet.public_key = decrypt(wallet.public_key);
    wallet.address = decrypt(wallet.address);
  });
  return data;
};

const getWalletByName = async (telegramId, walletName) => {
  const { data, error } = await supabase
    .from(TABLES.WALLETS)
    .select("*")
    .eq("telegram_id", telegramId)
    .eq("wallet_name", walletName)
    .eq("deleted", false)
    .single();

  if (error) throw error;
  data.private_key = decrypt(data.private_key);
  data.public_key = decrypt(data.public_key);
  data.address = decrypt(data.address);
  return data;
};

const updateWalletStatus = async (telegramId, walletName, isDefault) => {
  // First, remove default status from all wallets
  const { error: resetError } = await supabase
    .from(TABLES.WALLETS)
    .update({ is_default: false })
    .eq("telegram_id", telegramId);

  if (resetError) throw resetError;

  // Then, set the specified wallet as default
  const { error: updateError } = await supabase
    .from(TABLES.WALLETS)
    .update({ is_default: isDefault })
    .eq("telegram_id", telegramId)
    .eq("wallet_name", walletName);

  if (updateError) throw updateError;
};

export async function updateWalletName(telegramId, oldName, newName) {
  const { error } = await supabase
    .from(TABLES.WALLETS)
    .update({
      wallet_name: newName,
      updated_at: new Date().toISOString(),
    })
    .eq("telegram_id", telegramId)
    .eq("wallet_name", oldName);

  if (error) throw error;
}

const deleteWallet = async (telegramId, walletName) => {
  const { error } = await supabase
    .from(TABLES.WALLETS)
    .update({
      deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq("telegram_id", telegramId)
    .eq("wallet_name", walletName);

  if (error) throw error;
};

export {
  createWallet,
  getUserWallets,
  getWalletByName,
  updateWalletStatus,
  deleteWallet,
};
