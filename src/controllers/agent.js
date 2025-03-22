import { AgentRuntime, createAptosTools } from "move-agent-kit";
import { llm } from "../config/index.js";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { TokenAnalystTool, TokenMarketInfoTool } from "../tools/index.js";
import { aptos, getSignerAndAccount } from "../config/aptos.js";

const externalTools = [new TokenAnalystTool(), new TokenMarketInfoTool()];

const getAgentRuntime = async (privateKey) => {
  const { signer } = await getSignerAndAccount(privateKey);
  const agentRuntime = new AgentRuntime(signer, aptos);
  return agentRuntime;
};

const initializeAgent = async (wallet) => {
  try {
    const aptosAgent = await getAgentRuntime(wallet.private_key);
    const tools = createAptosTools(aptosAgent);
    const config = { configurable: { thread_id: wallet.telegram_id } };
    const memorySaver = new MemorySaver();
    const agent = createReactAgent({
      llm,
      tools: [...tools, ...externalTools],
      checkpointSaver: memorySaver,
      messageModifier: `
      You are a helpful agent that can interact onchain using the Move Agent Kit.
      You are empowered to interact onchain using your tools.
      If not, you can provide your wallet details and request funds from the user. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone asks you to do something you can't do with your currently available tools, you must say so, and encourage them to implement it themselves using the Move Agent Kit, recommend they go to the Aptos documentation for more information about Move development. Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.
      `,
    });
    return { agent, config };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
};

export { getAgentRuntime, initializeAgent };
