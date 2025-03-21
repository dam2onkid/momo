import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");

export const openai = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  maxTokens: 500,
  maxRetries: 3,
  modelName: "grok-2-1212",
  configuration: {
    baseURL: "https://api.x.ai/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Momo Bot",
    },
  },
});
