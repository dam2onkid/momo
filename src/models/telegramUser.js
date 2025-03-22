import { supabase } from "../config/supabase.js";
import { TABLES } from "./const.js";

const createOrUpdateUser = async (userData) => {
  if (!userData.telegram_id) {
    throw new Error("telegram_id is required");
  }

  const { data: existingUser, error: findError } = await supabase
    .from(TABLES.USERS)
    .select("*")
    .eq("telegram_id", userData.telegram_id)
    .maybeSingle();

  if (findError) {
    console.error("Error finding user:", findError);
    throw findError;
  }

  let updateData = {
    telegram_id: userData.telegram_id,
    first_name: userData.first_name || "",
    last_name: userData.last_name || "",
    updated_at: new Date().toISOString(),
  };

  // Add username to update data if provided
  if (userData.username) {
    updateData.username = userData.username;
  }

  // If user exists, just update their information
  if (existingUser) {
    console.log(
      `User exists with telegram_id ${userData.telegram_id}, updating information`
    );

    // Log username change if applicable
    if (existingUser.username !== userData.username && userData.username) {
      console.log(
        `Username updated: ${existingUser.username} -> ${userData.username}`
      );
    }

    // Keep some fields if not provided in the update
    if (!userData.username && existingUser.username) {
      updateData.username = existingUser.username;
    }
  } else {
    console.log(`Creating new user with telegram_id ${userData.telegram_id}`);
  }

  // Upsert user data (create or update based on telegram_id)
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .upsert(updateData)
    .select();

  if (error) {
    console.error("Error upserting user:", error);
    throw error;
  }

  return data[0];
};

/**
 * Get a user by username (case insensitive)
 */
const getUserByUsername = async (username) => {
  // Skip if username is empty or undefined
  if (!username) return null;

  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select("*")
    .ilike("username", username)
    .limit(1);

  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
};

/**
 * Get a user by Telegram ID
 */
const getUserById = async (telegramId) => {
  if (!telegramId) return null;

  const { data, error } = await supabase
    .from(TABLES.USERS)
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Find a user by any identifier (telegram_id or username)
 * Prioritizes finding by telegram_id since that's the unique identifier
 */
const findUserByIdentifier = async (identifier) => {
  if (!identifier) return null;

  // First try by telegram_id if it looks numeric
  if (/^\d+$/.test(identifier)) {
    const user = await getUserById(identifier);
    if (user) return user;
  }

  // Then try by username
  return await getUserByUsername(identifier);
};

export {
  createOrUpdateUser,
  getUserByUsername,
  getUserById,
  findUserByIdentifier,
};
