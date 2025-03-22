import { Tool } from "langchain/tools";
import axios from "axios";
import _ from "lodash";
class TokenAnalystTool extends Tool {
  name = "aptos_token_percentage";
  description = `"
this tool analyzes top token holders on the Aptos blockchain with detailed financial metrics

  it provides a comprehensive breakdown of at least 10 top token holders including:
  - wallet addresses of major holders
  - percentage of total supply each holder owns
  - APT balance in each holder's wallet
  - USD value of tokens held by each wallet

  example output for a token like GIN:
  top 1: 0x123...abc holds 4% of $GIN, Aptos balance: 100 APT, Coin value: $4.5M
  top 2: 0x456...def holds 0.1% of $GIN, Aptos balance: 2500 APT, Coin value: $400K
  ... (displays at least 10 holders)

  Inputs ( input is a JSON string ):
  tokenAddress: string, eg "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT" (required)
  limit: number, limit the number of top holders to display (optional, default: 10, minimum: 10)"`;

  constructor(agent) {
    super();
    this.agent = agent;
  }

  async _call(args) {
    try {
      // Handle both string and object inputs
      const { tokenAddress, limit = 10 } = JSON.parse(args);
      const holders = await this.getTopHolders(tokenAddress, limit);

      return JSON.stringify(
        {
          data: {
            info: _.get(holders, "info", {}),
            holders: _.get(holders, "holders", []),
          },
          status: "success",
        },
        null,
        2
      ); // Pretty print JSON with 2-space indentation
    } catch (error) {
      console.error("Error in token analysis:", error.message);
      return JSON.stringify({
        error: error.message || "Failed to analyze token percentages",
        status: "error",
      });
    }
  }

  async getTopHolders(tokenAddress, limit = 20) {
    const response = await axios.get(
      `https://api.aptoscan.com/v1/coins/${tokenAddress}/holders?cluster=mainnet&page=1`,
      {
        headers: {
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9",
          Referer: "https://aptoscan.com/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      }
    );

    const data = response.data;
    if (!data) return {};

    const holders = _.get(data, ["data", "coin_holders_list"], []).slice(
      0,
      limit
    );

    const sum_amount_holder = _.get(data, ["data", "sum_amount_holder"], 0);
    await Promise.all(
      holders.map(async (holder) => {
        holder.percentage = parseFloat(
          ((holder.amount / 100000000 / sum_amount_holder) * 100).toFixed(2)
        );
        holder.balance = parseFloat(
          (await this.getAccountAptBalance(holder.owner_address)).toFixed(2)
        );
        holder.wallet_value = parseFloat(
          (await this.getWalletValue(holder.owner_address)).toFixed(0)
        );
        holder.wallet_value_unit = "USD";
        holder.balance_unit = "APT";
      })
    );

    return { info: _.get(data, ["data", "coin_info"], {}), holders: holders };
  }

  async getAccountAptBalance(address) {
    try {
      const response = await axios.get(
        `https://api.aptoscan.com/v1/accounts/${address}?cluster=mainnet`,
        {
          headers: {
            accept: "application/json",
            "accept-language": "en-US,en;q=0.9",
            Referer: "https://aptoscan.com/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
        }
      );
      return _.get(response, "data.data.apt_coin.coin.value", 0) / 100000000;
    } catch (error) {
      console.error("Error fetching account:", error);
      throw error;
    }
  }

  async getWalletValue(address) {
    try {
      const response = await axios.get(
        `https://api.aptoscan.com/v1/accounts/${address}/coin_value?cluster=mainnet`,
        {
          headers: {
            accept: "application/json",
            "accept-language": "en-US,en;q=0.9",
            Referer: "https://aptoscan.com/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
        }
      );
      const data = response.data;
      return _.get(data, "data", 0);
    } catch (error) {
      console.error("Error fetching wallet value:", error);
      throw error;
    }
  }
}

export { TokenAnalystTool };
