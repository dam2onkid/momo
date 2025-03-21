import {
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  PrivateKey,
  Account,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { AgentRuntime, LocalSigner } from "move-agent-kit";

const getAgentRuntime = async (wallet) => {
  const aptosConfig = new AptosConfig({
    network: process.env.APTOS_NETWORK,
  });
  const aptos = new Aptos(aptosConfig);
  const privateKey = PrivateKey.formatPrivateKey(
    wallet.private_key,
    PrivateKeyVariants.Ed25519
  );
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey),
  });

  const signer = new LocalSigner(account, process.env.APTOS_NETWORK);
  const agentRuntime = new AgentRuntime(signer, aptos);
  return agentRuntime;
};

export { getAgentRuntime };
