import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.XAI_API_KEY) throw new Error("XAI_API_KEY is required");

export const llm = new ChatOpenAI({
  openAIApiKey: process.env.XAI_API_KEY,
  temperature: 0.7,
  maxTokens: 5000,
  maxRetries: 3,
  modelName: "grok-2-1212",
  configuration: {
    baseURL: "https://api.x.ai/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://t.me/momo_aptos_bot",
      "X-Title": "Momo Bot",
    },
  },
});
