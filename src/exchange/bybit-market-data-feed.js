import { BybitClient } from "./bybit-client.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentChange(current, previous) {
  if (!previous) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

function standardDeviation(values) {
  if (values.length === 0) {
    return 0;
  }
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function computeSpreadBps(bidPrice, askPrice, fallbackMid) {
  const bid = toNumber(bidPrice);
  const ask = toNumber(askPrice);
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : fallbackMid;
  if (!mid || bid <= 0 || ask <= 0) {
    return 99;
  }
  return ((ask - bid) / mid) * 10000;
}

function toCandles(rows) {
  return [...rows]
    .reverse()
    .map((row) => ({
      startTime: toNumber(row[0]),
      open: toNumber(row[1]),
      high: toNumber(row[2]),
      low: toNumber(row[3]),
      close: toNumber(row[4]),
      volume: toNumber(row[5]),
      turnover: toNumber(row[6])
    }));
}

function rankBySymbol(markets, valueKey) {
  if (markets.length === 0) {
    return {};
  }

  const sorted = [...markets].sort((left, right) => left[valueKey] - right[valueKey]);
  const denominator = Math.max(sorted.length - 1, 1);
  return Object.fromEntries(
    sorted.map((market, index) => [market.symbol, round((index / denominator) * 100, 2)])
  );
}

function selectSymbolsFromTickers(tickers, configuredSymbols, maxSymbols) {
  if (configuredSymbols.length > 0) {
    const tickerMap = new Map(tickers.map((ticker) => [ticker.symbol, ticker]));
    return configuredSymbols.map((symbol) => tickerMap.get(symbol)).filter(Boolean);
  }

  return [...tickers]
    .filter((ticker) => ticker.symbol.endsWith("USDT") && !ticker.symbol.includes("-"))
    .sort((left, right) => toNumber(right.turnover24h) - toNumber(left.turnover24h))
    .slice(0, maxSymbols);
}

function buildRawMarket(ticker, candles) {
  const lastPrice = toNumber(ticker.lastPrice);
  const markPrice = toNumber(ticker.markPrice, lastPrice);
  const closeSeries = candles.map((candle) => candle.close).filter((value) => value > 0);
  const highSeries = candles.map((candle) => candle.high).filter((value) => value > 0);
  const lowSeries = candles.map((candle) => candle.low).filter((value) => value > 0);
  const returns = closeSeries.slice(1).map((value, index) => percentChange(value, closeSeries[index]));
  const fastSlice = closeSeries.slice(-4);
  const slowSlice = closeSeries.slice(-12);
  const fastAverage = average(fastSlice.length > 0 ? fastSlice : closeSeries);
  const slowAverage = average(slowSlice.length > 0 ? slowSlice : closeSeries);
  const trendSlopePct = percentChange(fastAverage || lastPrice, slowAverage || lastPrice);
  const dailyChangePct = toNumber(ticker.price24hPcnt) * 100;
  const trendScore = clamp(dailyChangePct * 12 + trendSlopePct * 28, -60, 60);
  const shortLookback = closeSeries[Math.max(0, closeSeries.length - 4)] || lastPrice;
  const mediumLookback = closeSeries[Math.max(0, closeSeries.length - 8)] || lastPrice;
  const momentumShortPct = percentChange(lastPrice, shortLookback);
  const momentumMediumPct = percentChange(lastPrice, mediumLookback);
  const momentumScore = clamp(momentumShortPct * 24 + momentumMediumPct * 12, -60, 60);
  const maxHigh = highSeries.length > 0 ? Math.max(...highSeries) : lastPrice;
  const minLow = lowSeries.length > 0 ? Math.min(...lowSeries) : lastPrice;
  const rangeVolatilityPct = percentChange(maxHigh, minLow);
  const realizedVolatilityPct = standardDeviation(returns) * Math.sqrt(Math.max(returns.length, 1));
  const volatility24hPct = Math.max(Math.abs(rangeVolatilityPct), Math.abs(realizedVolatilityPct));
  const spreadBps = computeSpreadBps(ticker.bid1Price, ticker.ask1Price, lastPrice);
  const markPremiumPct = percentChange(lastPrice, markPrice);
  const positiveRatio = returns.length === 0 ? 0.5 : returns.filter((value) => value > 0).length / returns.length;
  const structureScore = clamp(
    48 +
      positiveRatio * 20 +
      (trendScore * momentumScore >= 0 ? 12 : -12) -
      Math.abs(markPremiumPct) * 180 -
      spreadBps * 0.7,
    0,
    100
  );

  return {
    symbol: ticker.symbol,
    lastPrice,
    markPrice,
    volume24hUsdt: toNumber(ticker.turnover24h),
    openInterestUsdt:
      toNumber(ticker.openInterestValue) || toNumber(ticker.openInterest) * Math.max(markPrice, lastPrice),
    fundingRatePct: toNumber(ticker.fundingRate) * 100,
    spreadBps: round(spreadBps, 2),
    trendScore: round(trendScore, 0),
    momentumScore: round(momentumScore, 0),
    structureScore: round(structureScore, 0),
    volatility24hPct: round(volatility24hPct, 2),
    dailyChangePct: round(dailyChangePct, 2),
    markPremiumPct: round(markPremiumPct, 4)
  };
}

export class BybitMarketDataFeed {
  constructor({ config, state, logger }) {
    this.config = config;
    this.state = state;
    this.logger = logger;
    this.client = new BybitClient({
      baseUrl: config.bybit.restBaseUrl,
      timeoutMs: config.bybit.timeoutMs,
      logger
    });
  }

  getMetadata() {
    return {
      provider: "bybit",
      category: this.config.bybit.category,
      restBaseUrl: this.config.bybit.restBaseUrl,
      testnet: this.config.bybit.testnet,
      symbols:
        this.config.bybit.symbols.length > 0
          ? this.config.bybit.symbols
          : `auto-top-${this.config.bybit.maxSymbols}`,
      klineInterval: this.config.bybit.klineInterval,
      klineLimit: this.config.bybit.klineLimit
    };
  }

  async persistUniverse(markets) {
    await this.state.writeJson("bybit-market-cache.json", {
      provider: "bybit",
      fetchedAt: new Date().toISOString(),
      markets
    });
  }

  async resolveUniverseTickers() {
    const tickers = await this.client.getTickers({ category: this.config.bybit.category });
    const selected = selectSymbolsFromTickers(
      tickers,
      this.config.bybit.symbols,
      this.config.bybit.maxSymbols
    );

    if (selected.length === 0) {
      throw new Error("No Bybit symbols matched the current configuration");
    }

    if (this.config.bybit.symbols.length > 0 && selected.length !== this.config.bybit.symbols.length) {
      const selectedSymbols = new Set(selected.map((ticker) => ticker.symbol));
      const missingSymbols = this.config.bybit.symbols.filter((symbol) => !selectedSymbols.has(symbol));
      this.logger.warn("Some configured Bybit symbols were not returned by the API", {
        missingSymbols
      });
    }

    return selected;
  }

  async getMarketUniverse() {
    const selectedTickers = await this.resolveUniverseTickers();
    const klinesBySymbol = await Promise.all(
      selectedTickers.map((ticker) =>
        this.client.getKlines({
          category: this.config.bybit.category,
          symbol: ticker.symbol,
          interval: this.config.bybit.klineInterval,
          limit: this.config.bybit.klineLimit
        })
      )
    );

    const rawMarkets = selectedTickers.map((ticker, index) =>
      buildRawMarket(ticker, toCandles(klinesBySymbol[index]))
    );
    const liquidityTurnoverRanks = rankBySymbol(rawMarkets, "volume24hUsdt");
    const liquidityOiRanks = rankBySymbol(rawMarkets, "openInterestUsdt");
    const volatilityRanks = rankBySymbol(rawMarkets, "volatility24hPct");

    const markets = rawMarkets.map((market) => {
      const liquidityScore = clamp(
        liquidityTurnoverRanks[market.symbol] * 0.6 + liquidityOiRanks[market.symbol] * 0.4,
        0,
        100
      );
      const narrativeScore = clamp(
        35 +
          liquidityTurnoverRanks[market.symbol] * 0.35 +
          volatilityRanks[market.symbol] * 0.4 +
          Math.min(Math.abs(market.dailyChangePct) * 4, 18),
        0,
        100
      );

      return {
        ...market,
        liquidityScore: round(liquidityScore, 0),
        narrativeScore: round(narrativeScore, 0)
      };
    });

    await this.persistUniverse(markets);
    return markets;
  }

  async getQuote(symbol) {
    const tickers = await this.client.getTickers({
      category: this.config.bybit.category,
      symbol
    });
    const ticker = tickers.find((item) => item.symbol === symbol);
    if (!ticker) {
      throw new Error(`No Bybit ticker found for ${symbol}`);
    }

    return {
      symbol,
      markPrice: toNumber(ticker.markPrice) || toNumber(ticker.lastPrice),
      spreadBps: round(
        computeSpreadBps(ticker.bid1Price, ticker.ask1Price, toNumber(ticker.lastPrice)),
        2
      ),
      fundingRatePct: round(toNumber(ticker.fundingRate) * 100, 4),
      timestamp: new Date().toISOString()
    };
  }

  async getQuotes(symbols) {
    if (symbols.length === 0) {
      return {};
    }

    const tickers = await this.client.getTickers({ category: this.config.bybit.category });
    const symbolSet = new Set(symbols);
    const filtered = tickers.filter((ticker) => symbolSet.has(ticker.symbol));

    return Object.fromEntries(
      filtered.map((ticker) => [
        ticker.symbol,
        {
          symbol: ticker.symbol,
          markPrice: toNumber(ticker.markPrice) || toNumber(ticker.lastPrice),
          spreadBps: round(
            computeSpreadBps(ticker.bid1Price, ticker.ask1Price, toNumber(ticker.lastPrice)),
            2
          ),
          fundingRatePct: round(toNumber(ticker.fundingRate) * 100, 4),
          timestamp: new Date().toISOString()
        }
      ])
    );
  }
}
