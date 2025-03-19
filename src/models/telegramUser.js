import { supabase } from "../config/supabase.js";
import { TABLES } from "./const.js";

// User operations
const createOrUpdateUser = async (userData) => {
  console.log(userData);
  const { data, error } = await supabase
    .from(TABLES.USERS)
    .upsert({
      telegram_id: userData.telegram_id,
      username: userData.username,
      name: userData.name,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (error) throw error;
  return data[0];
};

export { createOrUpdateUser };
