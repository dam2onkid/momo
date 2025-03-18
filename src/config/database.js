import { supabase } from "./supabase.js";

// Table Names
export const TABLES = {
  USERS: "telegram_users",
  WALLETS: "aptos_wallets",
};

// Initialize database tables
export async function initializeTables() {
  // Create telegram_users table if not exists
  const { error: usersError } = await supabase.rpc(
    "create_telegram_users_table",
    {
      sql: `
      CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
        telegram_id TEXT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );
    `,
    }
  );

  if (usersError) {
    console.error("Error creating users table:", usersError);
    throw usersError;
  }

  // Create aptos_wallets table if not exists
  const { error: walletsError } = await supabase.rpc(
    "create_aptos_wallets_table",
    {
      sql: `
      CREATE TABLE IF NOT EXISTS ${TABLES.WALLETS} (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        telegram_id TEXT REFERENCES ${TABLES.USERS}(telegram_id),
        wallet_name TEXT,
        private_key TEXT,
        public_key TEXT,
        address TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        UNIQUE(telegram_id, wallet_name)
      );
    `,
    }
  );

  if (walletsError) {
    console.error("Error creating wallets table:", walletsError);
    throw walletsError;
  }
}

// User operations
export async function createOrUpdateUser(userData) {
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .upsert({
      telegram_id: userData.telegram_id,
      username: userData.username,
      first_name: userData.first_name,
      last_name: userData.last_name,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (error) throw error;
  return data[0];
}

// Wallet operations
export async function createWallet(walletData) {
  const { data, error } = await supabase
    .from(TABLES.WALLETS)
    .insert({
      telegram_id: walletData.telegram_id,
      wallet_name: walletData.wallet_name,
      private_key: walletData.private_key,
      public_key: walletData.public_key,
      address: walletData.address,
    })
    .select();

  if (error) throw error;
  return data[0];
}

export async function getUserWallets(telegramId) {
  const { data, error } = await supabase
    .from(TABLES.WALLETS)
    .select("*")
    .eq("telegram_id", telegramId)
    .eq("is_active", true);

  if (error) throw error;
  return data;
}

export async function getWalletByName(telegramId, walletName) {
  const { data, error } = await supabase
    .from(TABLES.WALLETS)
    .select("*")
    .eq("telegram_id", telegramId)
    .eq("wallet_name", walletName)
    .eq("is_active", true)
    .single();

  if (error) throw error;
  return data;
}
