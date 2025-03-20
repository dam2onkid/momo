import { TABLES } from "./const.js";
import { supabase } from "../config/supabase.js";
import { encrypt } from "../utils/encrypt.js";

// Wallet operations
const createWallet = async (walletData) => {
  const { data, error } = await supabase
    .from(TABLES.WALLETS)
    .insert({
      telegram_id: walletData.telegram_id,
      wallet_name: walletData.wallet_name,
      // private_key: encrypt(walletData.private_key),
      private_key: walletData.private_key,
      public_key: walletData.public_key,
      address: walletData.address,
      is_default: walletData.is_default || false,
    })
    .select();

  if (error) throw error;
  return data[0];
};

const getUserWallets = async (telegramId) => {
  const { data, error } = await supabase
    .from(TABLES.WALLETS)
    .select("*")
    .eq("telegram_id", telegramId)
    .eq("deleted", false);

  if (error) throw error;
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

export { createWallet, getUserWallets, getWalletByName, updateWalletStatus };
