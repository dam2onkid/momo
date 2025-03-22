import { Tool } from "langchain/tools";
import axios from "axios";

class TokenMarketInfoTool extends Tool {
  name = "aptos_token_market_info";
  description = `"
This tool fetches detailed market information for Aptos blockchain tokens and formats it for Telegram messages.

It provides a concise, well-formatted message with key trading metrics:
  📊 Token: [Symbol] ([Name])
  💰 Price: $X.XX (↑↓X.X% 24h, ↑↓X.X% 7d)
  📈 Volume (24h): $XX.XM
  💧 Liquidity: $XX.XM
  🏦 Market Cap: $X.XB

The message is optimized for Telegram's display format with clear emoji indicators and proper spacing for easy reading on mobile devices.

Example Telegram message:
📊 Token: APT (Aptos)
💰 Price: $8.42 (↓2.3% 24h, ↑5.7% 7d)
📈 Volume (24h): $24.5M
💧 Liquidity: $12.8M
🏦 Market Cap: $1.2B

Inputs (input is a JSON string):
  tokenAddress: string, eg "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT" (required)
  timeframe: string, time period for data aggregation, options: "5m", "1h", "6h", "24h", "7d", "30d" (optional, default: "24h")
  includePairs: boolean, whether to include trading pair information (optional, default: false)"`;

  constructor(agent) {
    super();
    this.agent = agent;
    this.baseUrl = "https://api.dexscreener.com/latest/dex";

    // Define all supported timeframes
    this.supportedTimeframes = {
      "5m": { label: "5 minutes", priceKey: "m5", volumeKey: "m5" },
      "1h": { label: "1 hour", priceKey: "h1", volumeKey: "h1" },
      "6h": { label: "6 hours", priceKey: "h6", volumeKey: "h6" },
      "24h": { label: "24 hours", priceKey: "h24", volumeKey: "h24" },
      "7d": { label: "7 days", priceKey: "d7", volumeKey: "d7" },
      "30d": { label: "30 days", priceKey: "d30", volumeKey: "d30" },
    };
  }

  async _call(args) {
    try {
      const params = JSON.parse(args);
      const { tokenAddress, timeframe = "24h", includePairs = false } = params;

      // Validate timeframe
      if (timeframe && !this.supportedTimeframes[timeframe]) {
        return JSON.stringify({
          error: `Invalid timeframe. Supported timeframes are: ${Object.keys(
            this.supportedTimeframes
          ).join(", ")}`,
          status: "error",
        });
      }

      if (!tokenAddress) {
        return JSON.stringify({
          error: "Token address is required",
          status: "error",
        });
      }

      // Get all pairs for the token
      const allPairs = await this.getTokenPairs(tokenAddress);

      if (!allPairs || allPairs.length === 0) {
        return JSON.stringify({
          error: "No trading pairs found for this token",
          status: "error",
        });
      }

      // Find pair with highest liquidity
      const highestLiquidityPair = this.findHighestLiquidityPair(allPairs);

      // Get detailed token data using the highest liquidity pair
      const tokenData = await this.getTokenData(
        highestLiquidityPair.pairAddress
      );

      // Structure data for traders
      const marketData = this.structureMarketData(
        tokenData,
        highestLiquidityPair,
        timeframe,
        allPairs,
        includePairs
      );

      // Format the response for readability
      const formattedResponse = this.formatResponse(marketData);

      return JSON.stringify(
        {
          data: formattedResponse,
          status: "success",
        },
        null,
        2
      ); // Pretty print JSON with 2-space indentation
    } catch (error) {
      return JSON.stringify(
        {
          error: error.message || "Failed to fetch token market information",
          status: "error",
        },
        null,
        2
      ); // Pretty print error JSON
    }
  }

  formatResponse(marketData) {
    // Create a summary section with the most important data
    const summary = {
      token: `${marketData.token.name} (${marketData.token.symbol})`,
      price: `${marketData.price.current} USD (${marketData.price.change} over ${marketData.price.changeTimeframe})`,
      trend: marketData.price.trend.toUpperCase(),
      liquidity: marketData.market.liquidity.formatted,
      volume: `${marketData.market.volume.formatted} (${marketData.market.volume.timeframe})`,
      marketCap: marketData.market.marketCap.formatted,
      exchange: `${marketData.exchange.dex} (paired with ${marketData.exchange.quoteToken.symbol})`,
      updatedAt: new Date(marketData.updatedAt).toLocaleString(),
    };

    // Format trading signals for traders
    const tradingSignals = {
      volumeToLiquidity: {
        value: marketData.indicators.volumeToLiquidity.formatted,
        rating: marketData.indicators.volumeToLiquidity.rating.toUpperCase(),
        interpretation: this.interpretVolumeToLiquidity(
          marketData.indicators.volumeToLiquidity.rating
        ),
      },
      priceVolatility: {
        value: `${marketData.indicators.priceVolatility.value}%`,
        rating: marketData.indicators.priceVolatility.rating.toUpperCase(),
        interpretation: this.interpretVolatility(
          marketData.indicators.priceVolatility.rating
        ),
      },
      liquidityDepth: {
        value: marketData.indicators.liquidityDepth.formatted,
        rating: marketData.indicators.liquidityDepth.rating.toUpperCase(),
        interpretation: this.interpretLiquidityDepth(
          marketData.indicators.liquidityDepth.rating
        ),
      },
    };

    // Format transaction data
    const transactions = {
      total: marketData.market.txns.total,
      buys: marketData.market.txns.buys,
      sells: marketData.market.txns.sells,
      buyToSellRatio:
        marketData.market.txns.buys > 0 && marketData.market.txns.sells > 0
          ? (
              marketData.market.txns.buys / marketData.market.txns.sells
            ).toFixed(2)
          : "N/A",
      timeframe: marketData.market.txns.timeframe,
    };

    // Format available timeframes
    const availableTimeframes = Object.entries(marketData.availableTimeframes)
      .filter(([_, data]) => data.available)
      .map(([key, data]) => `${key} (${data.label})`)
      .join(", ");

    // Format trading pairs in a more concise way
    let pairs = null;
    if (marketData.allPairs) {
      pairs = marketData.allPairs.map((pair) => ({
        dex: pair.dex,
        quoteToken: pair.quoteToken,
        price: pair.price,
        liquidity: pair.formatted.liquidity,
        volume24h: pair.formatted.volume24h,
        isHighestLiquidity: pair.isHighestLiquidity ? "★ BEST LIQUIDITY ★" : "",
      }));
    }

    // Assemble the final formatted response
    const formattedResponse = {
      summary,
      tradingSignals,
      transactions,
      availableTimeframes,
      tokenDetails: {
        name: marketData.token.name,
        symbol: marketData.token.symbol,
        address: marketData.token.address,
      },
      pairs: pairs,
    };

    return formattedResponse;
  }

  interpretVolumeToLiquidity(rating) {
    switch (rating) {
      case "low":
        return "Low trading activity relative to available liquidity";
      case "moderate":
        return "Moderate trading activity, average market interest";
      case "good":
        return "Good trading activity, healthy market interest";
      case "high":
        return "High trading activity, strong market interest";
      default:
        return "Unknown rating";
    }
  }

  interpretVolatility(rating) {
    switch (rating) {
      case "low":
        return "Low price volatility, stable price action";
      case "moderate":
        return "Moderate price swings, typical volatility";
      case "high":
        return "High volatility, significant price swings";
      case "very high":
        return "Extreme volatility, potential for large price movements";
      default:
        return "Unknown rating";
    }
  }

  interpretLiquidityDepth(rating) {
    switch (rating) {
      case "very low":
        return "Very limited liquidity, high slippage likely";
      case "low":
        return "Limited liquidity, moderate slippage expected";
      case "moderate":
        return "Adequate liquidity for smaller trades";
      case "good":
        return "Good liquidity, minimal slippage for most trades";
      case "excellent":
        return "Deep liquidity, minimal slippage even for larger trades";
      default:
        return "Unknown rating";
    }
  }

  async getTokenData(pairAddress) {
    try {
      const url = `${this.baseUrl}/pairs/aptos/${pairAddress}`;
      const response = await axios.get(url);
      const data = response.data;

      if (data.pairs && data.pairs.length > 0) {
        return data.pairs[0];
      }
      throw new Error("No data found for this pair");
    } catch (error) {
      throw new Error(`Error fetching pair data: ${error.message}`);
    }
  }

  async getTokenPairs(tokenAddress) {
    try {
      const url = `${this.baseUrl}/tokens/${tokenAddress}`;
      const response = await axios.get(url);
      const data = response.data;

      if (data.pairs && data.pairs.length > 0) {
        // Filter for Aptos pairs
        const aptosPairs = data.pairs.filter(
          (pair) => pair.chainId === "aptos"
        );

        if (aptosPairs.length === 0) {
          throw new Error("No pairs found on Aptos for this token");
        }

        return aptosPairs;
      } else {
        throw new Error("No pairs found for this token address");
      }
    } catch (error) {
      throw new Error(`Error fetching token pairs: ${error.message}`);
    }
  }

  findHighestLiquidityPair(pairs) {
    if (!pairs || pairs.length === 0) return null;

    return pairs.reduce((highest, current) => {
      const currentLiquidity = parseFloat(current.liquidity?.usd || 0);
      const highestLiquidity = parseFloat(highest.liquidity?.usd || 0);

      return currentLiquidity > highestLiquidity ? current : highest;
    }, pairs[0]);
  }

  structureMarketData(
    tokenData,
    highestLiquidityPair,
    timeframe,
    allPairs,
    includePairs
  ) {
    // Calculate additional metrics useful for traders
    const priceChange = this.getPriceChange(tokenData, timeframe);
    const priceChangeNum = parseFloat(priceChange.replace("%", ""));

    // Get timeframe label for display
    const timeframeLabel =
      this.supportedTimeframes[timeframe]?.label || "24 hours";

    // Structure market data with focus on trading metrics
    const marketData = {
      // Basic token info
      token: {
        name: tokenData.baseToken.name,
        symbol: tokenData.baseToken.symbol,
        address: tokenData.baseToken.address,
      },

      // Price data
      price: {
        current: parseFloat(tokenData.priceUsd),
        change: priceChange,
        changeTimeframe: timeframeLabel,
        trend:
          priceChangeNum > 0
            ? "bullish"
            : priceChangeNum < 0
            ? "bearish"
            : "neutral",
      },

      // Market activity
      market: {
        liquidity: {
          usd: parseFloat(tokenData.liquidity?.usd || 0),
          formatted: this.formatCurrency(tokenData.liquidity?.usd),
        },
        volume: {
          value: parseFloat(this.getVolumeForTimeframe(tokenData, timeframe)),
          formatted: this.formatCurrency(
            this.getVolumeForTimeframe(tokenData, timeframe)
          ),
          timeframe: timeframeLabel,
        },
        marketCap: {
          value: parseFloat(tokenData.fdv || 0),
          formatted: this.formatCurrency(tokenData.fdv),
        },
        txns: this.getTransactionsData(tokenData, timeframe),
      },

      // Trading indicators
      indicators: {
        volumeToLiquidity: this.calculateVolumeToLiquidity(
          tokenData,
          timeframe
        ),
        priceVolatility: this.estimateVolatility(tokenData, timeframe),
        liquidityDepth: this.assessLiquidityDepth(tokenData),
      },

      // Exchange info
      exchange: {
        dex: tokenData.dexId,
        pairAddress: tokenData.pairAddress,
        quoteToken: {
          symbol: tokenData.quoteToken.symbol,
          address: tokenData.quoteToken.address,
        },
      },

      // Available timeframes for this token
      availableTimeframes: this.getAvailableTimeframes(tokenData),

      // Timestamp for data freshness
      updatedAt: new Date().toISOString(),
    };

    // Include trading pairs if requested
    if (includePairs) {
      marketData.allPairs = allPairs.map((pair) => ({
        dex: pair.dexId,
        pairAddress: pair.pairAddress,
        quoteToken: pair.quoteToken.symbol,
        price: parseFloat(pair.priceUsd),
        liquidity: parseFloat(pair.liquidity?.usd || 0),
        volume24h: parseFloat(pair.volume?.h24 || 0),
        formatted: {
          liquidity: this.formatCurrency(pair.liquidity?.usd),
          volume24h: this.formatCurrency(pair.volume?.h24),
        },
        isHighestLiquidity:
          pair.pairAddress === highestLiquidityPair.pairAddress,
      }));
    }

    return marketData;
  }

  getAvailableTimeframes(tokenData) {
    // Determine which timeframes have data available
    const availableFrames = {};

    Object.entries(this.supportedTimeframes).forEach(([key, config]) => {
      // Check if price change data exists for this timeframe
      const hasPriceData =
        tokenData.priceChange &&
        tokenData.priceChange[config.priceKey] !== undefined;

      // Check if volume data exists for this timeframe
      const hasVolumeData =
        tokenData.volume && tokenData.volume[config.volumeKey] !== undefined;

      availableFrames[key] = {
        available: hasPriceData || hasVolumeData,
        label: config.label,
      };
    });

    return availableFrames;
  }

  getTransactionsData(tokenData, timeframe) {
    // Extract transaction data if available
    const txnsKey = this.getTimeframeKey(timeframe, "txns");

    if (tokenData.txns && txnsKey && tokenData.txns[txnsKey]) {
      return {
        buys: tokenData.txns[txnsKey].buys || 0,
        sells: tokenData.txns[txnsKey].sells || 0,
        total:
          (tokenData.txns[txnsKey].buys || 0) +
          (tokenData.txns[txnsKey].sells || 0),
        timeframe: this.supportedTimeframes[timeframe]?.label || "24 hours",
      };
    }

    return {
      buys: 0,
      sells: 0,
      total: 0,
      timeframe: this.supportedTimeframes[timeframe]?.label || "24 hours",
    };
  }

  getTimeframeKey(timeframe, metric) {
    if (!timeframe || !this.supportedTimeframes[timeframe]) {
      return metric === "priceChange"
        ? "h24"
        : metric === "volume"
        ? "h24"
        : metric === "txns"
        ? "h24"
        : "h24";
    }

    const config = this.supportedTimeframes[timeframe];

    switch (metric) {
      case "priceChange":
        return config.priceKey;
      case "volume":
        return config.volumeKey;
      case "txns":
        return config.volumeKey; // Txns typically use the same key format as volume
      default:
        return config.volumeKey;
    }
  }

  getPriceChange(tokenData, timeframe) {
    let priceChange = "0%";
    const priceChangeKey = this.getTimeframeKey(timeframe, "priceChange");

    if (
      tokenData.priceChange &&
      tokenData.priceChange[priceChangeKey] !== undefined
    ) {
      // Ensure priceChange is a string, as it might be a number in the API response
      priceChange = String(tokenData.priceChange[priceChangeKey]);
    }

    // Ensure percentage format
    if (!priceChange.includes("%")) {
      priceChange = `${priceChange}%`;
    }

    return priceChange;
  }

  getVolumeForTimeframe(tokenData, timeframe) {
    const volumeKey = this.getTimeframeKey(timeframe, "volume");

    if (tokenData.volume && tokenData.volume[volumeKey] !== undefined) {
      return tokenData.volume[volumeKey];
    }

    return "0";
  }

  calculateVolumeToLiquidity(tokenData, timeframe) {
    const volume = parseFloat(
      this.getVolumeForTimeframe(tokenData, timeframe) || 0
    );
    const liquidity = parseFloat(tokenData.liquidity?.usd || 1); // Avoid division by zero

    const ratio = volume / liquidity;

    // Interpret the ratio
    let rating;
    if (ratio < 0.1) rating = "low";
    else if (ratio < 0.3) rating = "moderate";
    else if (ratio < 0.5) rating = "good";
    else rating = "high";

    return {
      ratio: ratio.toFixed(3),
      value: volume / liquidity,
      rating,
      formatted: `${(ratio * 100).toFixed(1)}%`,
    };
  }

  estimateVolatility(tokenData, timeframe) {
    // Simple volatility estimation based on price change
    // In a real implementation, this would use standard deviation of price changes
    const priceChange = this.getPriceChange(tokenData, timeframe);
    const priceChangeValue = Math.abs(parseFloat(priceChange.replace("%", "")));

    let rating;
    if (priceChangeValue < 3) rating = "low";
    else if (priceChangeValue < 7) rating = "moderate";
    else if (priceChangeValue < 15) rating = "high";
    else rating = "very high";

    return {
      value: priceChangeValue,
      rating,
      timeframe: this.supportedTimeframes[timeframe]?.label || "24 hours",
    };
  }

  assessLiquidityDepth(tokenData) {
    const liquidity = parseFloat(tokenData.liquidity?.usd || 0);

    let rating;
    if (liquidity < 10000) rating = "very low";
    else if (liquidity < 50000) rating = "low";
    else if (liquidity < 250000) rating = "moderate";
    else if (liquidity < 1000000) rating = "good";
    else rating = "excellent";

    return {
      value: liquidity,
      rating,
      formatted: this.formatCurrency(liquidity),
    };
  }

  formatCurrency(value) {
    if (!value) return "$0";

    const numValue = parseFloat(value);

    if (numValue >= 1000000000) {
      return `$${(numValue / 1000000000).toFixed(2)}B`;
    } else if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(2)}M`;
    } else if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(2)}K`;
    } else {
      return `$${numValue.toFixed(2)}`;
    }
  }
}

export { TokenMarketInfoTool };
