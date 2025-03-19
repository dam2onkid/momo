import { AgentRuntime } from "move-agent-kit";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

import { getSignerByTelegramId } from "./wallet.js";

const getAgentRunTime = async (telegramId) => {
  const aptosConfig = new AptosConfig({
    network: Network.MAINNET,
  });
  const aptos = new Aptos(aptosConfig);
  const signer = await getSignerByTelegramId(telegramId);
  const agentRunTime = new AgentRuntime({
    aptos,
    signer,
  });
  return agentRunTime;
};

export { getAgentRunTime };
