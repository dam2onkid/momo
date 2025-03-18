import { Aptos, Network, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { LocalSigner } from "move-agent-kit";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.APTOS_PRIVATE_KEY)
  throw new Error("APTOS_PRIVATE_KEY is required");
if (!process.env.APTOS_NETWORK) throw new Error("APTOS_NETWORK is required");

const getNetwork = (network) => {
  switch (network.toLowerCase()) {
    case "mainnet":
      return Network.MAINNET;
    case "testnet":
      return Network.TESTNET;
    case "devnet":
      return Network.DEVNET;
    default:
      return Network.MAINNET;
  }
};

export const aptosClient = new Aptos({
  network: getNetwork(process.env.APTOS_NETWORK),
  signer: new LocalSigner(
    Ed25519PrivateKey.fromHex(process.env.APTOS_PRIVATE_KEY)
  ),
});
