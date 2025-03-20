import { AgentRuntime } from "move-agent-kit";
import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk";

const getAgentRunTime = async (signer) => {
  const aptosConfig = new AptosConfig({
    network: process.env.APTOS_NETWORK,
  });
  const aptos = new Aptos(aptosConfig);
  const agentRunTime = new AgentRuntime({
    aptos,
    signer,
  });
  return agentRunTime;
};

export { getAgentRunTime };
