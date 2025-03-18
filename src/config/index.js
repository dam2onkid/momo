export { supabase } from "./supabase.js";
export { aptosClient } from "./aptos.js";
export { openai } from "./openai.js";

// Environment variables validation
import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  "BOT_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "OPENAI_API_KEY",
  "APTOS_PRIVATE_KEY",
  "APTOS_NETWORK",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`);
  }
}
