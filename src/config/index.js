export { supabase } from "./supabase.js";
export { aptos, aptosConfig, getSignerAndAccount } from "./aptos.js";
export { llm } from "./llm.js";

// Environment variables validation
import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  "BOT_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "APTOS_PRIVATE_KEY",
  "APTOS_NETWORK",
  "ENCRYPTION_KEY",
  "XAI_API_KEY",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`);
  }
}
