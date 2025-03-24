import { Tool } from "langchain/tools";
import axios from "axios";
import _ from "lodash";

class TokenTrendingTool extends Tool {
  name = "aptos_trending_tokens";
  description = `"
this tool retrieves trending tokens on the Aptos blockchain based on volume or transactions (txns)

  it provides a list of trending tokens on Aptos with details including:
  - token name
  - token symbol
  - token address
  - 24-hour trading volume
  - current price in USD
  - pair address for the trading pair

  example output:
  trending tokens on Aptos:
  1. APT (Aptos), volume: $50M, price: $7.23
  2. CAKE (PancakeSwap), volume: $2.3M, price: $2.15
  ... (displays trending tokens based on specified limit)

  Inputs (input is a JSON string):
  limit: number, limit the number of trending tokens to display (optional, default: 5)
  by: string, metric to sort by ('volume' or 'txns') (optional, default: 'volume')"`;

  constructor(agent) {
    super();
    this.agent = agent;
  }

  async _call(args) {
    try {
      // Handle both string and object inputs
      const params = typeof args === "string" ? JSON.parse(args) : args;
      const { limit = 5, by = "volume" } = params;

      const trendingTokens = await this.getTrendingAptosCoins(limit, by);

      return JSON.stringify(
        {
          data: {
            trending_tokens: trendingTokens,
          },
          status: "success",
        },
        null,
        2
      ); // Pretty print JSON with 2-space indentation
    } catch (error) {
      console.error("Error fetching trending tokens:", error.message);
      return JSON.stringify({
        error: error.message || "Failed to fetch trending tokens",
        status: "error",
      });
    }
  }

  // Base URL for Dexscreener API
  BASE_URL = "https://api.dexscreener.com/latest/dex/search";

  async getTrendingAptosCoins(limit = 5, by = "volume") {
    try {
      // Query Dexscreener API with a broad search
      const response = await axios.get(`${this.BASE_URL}?q=aptos`, {
        headers: {
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9",
          Referer: "https://dexscreener.com/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      });

      // Extract pairs from the response
      const pairs = _.get(response, "data.pairs", []);

      // Filter pairs to only include those on the Aptos blockchain
      const aptosPairs = pairs.filter((pair) => pair.chainId === "aptos");

      if (aptosPairs.length === 0) {
        console.log("No pairs found on the Aptos blockchain.");
        return [];
      }

      // Sort pairs by specified metric (default: volume.h24) in descending order
      const trendingPairs = aptosPairs.sort((a, b) => {
        if (by === "volume") {
          return parseFloat(b.volume.h24 || 0) - parseFloat(a.volume.h24 || 0);
        }
        // Add other sorting options if needed
        return parseFloat(b[by] || 0) - parseFloat(a[by] || 0);
      });

      // Limit to top trending pairs
      const topTrending = trendingPairs.slice(0, limit);

      // Format and return the results
      return topTrending.map((pair) => {
        return {
          name: pair.baseToken.name || "Unknown",
          symbol: pair.baseToken.symbol || "???",
          address: pair.baseToken.address,
          volume: parseFloat(pair.volume.h24 || 0),
          volume_unit: "USD",
          price: parseFloat(pair.priceUsd || 0),
          price_unit: "USD",
          pairAddress: pair.pairAddress,
          priceChange: {
            h1: parseFloat(_.get(pair, "priceChange.h1", 0)),
            h24: parseFloat(_.get(pair, "priceChange.h24", 0)),
            h7d: parseFloat(_.get(pair, "priceChange.h7d", 0)),
          },
          liquidity: {
            usd: parseFloat(_.get(pair, "liquidity.usd", 0)),
          },
          fdv: parseFloat(_.get(pair, "fdv", 0)),
        };
      });
    } catch (error) {
      console.error("Error fetching trending tokens:", error.message);
      return [];
    }
  }
}

export { TokenTrendingTool };

// const tokenTrendingTool = new TokenTrendingTool();
// const rs = await tokenTrendingTool._call(
//   JSON.stringify({
//     limit: 5,
//     by: "txns",
//   })
// );
// console.log(rs);
