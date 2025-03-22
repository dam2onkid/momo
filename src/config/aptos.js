import {
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  PrivateKey,
  PrivateKeyVariants,
  Account,
} from "@aptos-labs/ts-sdk";
import { LocalSigner } from "move-agent-kit";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.APTOS_PRIVATE_KEY)
  throw new Error("APTOS_PRIVATE_KEY is required");
if (!process.env.APTOS_NETWORK) throw new Error("APTOS_NETWORK is required");

const aptosConfig = new AptosConfig({
  network: process.env.APTOS_NETWORK,
});
const aptos = new Aptos(aptosConfig);

const getSignerAndAccount = async (privateKey) => {
  if (!privateKey) {
    throw new Error("Private key is not set for this wallet.");
  }
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(privateKey, PrivateKeyVariants.Ed25519)
    ),
  });

  const signer = new LocalSigner(account, process.env.APTOS_NETWORK);
  return { signer, account };
};

export { aptos, aptosConfig, getSignerAndAccount };
