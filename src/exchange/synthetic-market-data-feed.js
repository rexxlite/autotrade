const BASE_MARKETS = [
  {
    symbol: "BTCUSDT",
    lastPrice: 84350,
    volume24hUsdt: 960000000,
    openInterestUsdt: 550000000,
    fundingRatePct: 0.012,
    spreadBps: 1.2,
    trendScore: 41,
    momentumScore: 24,
    liquidityScore: 96,
    structureScore: 88,
    narrativeScore: 62,
    volatility24hPct: 2.9
  },
  {
    symbol: "ETHUSDT",
    lastPrice: 1628,
    volume24hUsdt: 610000000,
    openInterestUsdt: 240000000,
    fundingRatePct: 0.01,
    spreadBps: 1.5,
    trendScore: 38,
    momentumScore: 22,
    liquidityScore: 93,
    structureScore: 84,
    narrativeScore: 66,
    volatility24hPct: 3.7
  },
  {
    symbol: "SOLUSDT",
    lastPrice: 184.2,
    volume24hUsdt: 410000000,
    openInterestUsdt: 160000000,
    fundingRatePct: 0.026,
    spreadBps: 2.2,
    trendScore: 45,
    momentumScore: 27,
    liquidityScore: 89,
    structureScore: 78,
    narrativeScore: 80,
    volatility24hPct: 5.2
  },
  {
    symbol: "XRPUSDT",
    lastPrice: 0.842,
    volume24hUsdt: 225000000,
    openInterestUsdt: 95000000,
    fundingRatePct: -0.005,
    spreadBps: 2.8,
    trendScore: -34,
    momentumScore: -29,
    liquidityScore: 78,
    structureScore: 70,
    narrativeScore: 54,
    volatility24hPct: 4.1
  },
  {
    symbol: "DOGEUSDT",
    lastPrice: 0.188,
    volume24hUsdt: 260000000,
    openInterestUsdt: 120000000,
    fundingRatePct: 0.031,
    spreadBps: 3.8,
    trendScore: 29,
    momentumScore: 17,
    liquidityScore: 76,
    structureScore: 64,
    narrativeScore: 58,
    volatility24hPct: 6.4
  },
  {
    symbol: "WIFUSDT",
    lastPrice: 2.74,
    volume24hUsdt: 175000000,
    openInterestUsdt: 72000000,
    fundingRatePct: -0.02,
    spreadBps: 4.3,
    trendScore: -39,
    momentumScore: -26,
    liquidityScore: 69,
    structureScore: 57,
    narrativeScore: 71,
    volatility24hPct: 8.1
  },
  {
    symbol: "PEPEUSDT",
    lastPrice: 0.0000107,
    volume24hUsdt: 305000000,
    openInterestUsdt: 135000000,
    fundingRatePct: 0.035,
    spreadBps: 4.6,
    trendScore: 33,
    momentumScore: 28,
    liquidityScore: 73,
    structureScore: 60,
    narrativeScore: 77,
    volatility24hPct: 9.3
  },
  {
    symbol: "ARBUSDT",
    lastPrice: 1.06,
    volume24hUsdt: 118000000,
    openInterestUsdt: 53000000,
    fundingRatePct: -0.008,
    spreadBps: 4.9,
    trendScore: -18,
    momentumScore: -11,
    liquidityScore: 63,
    structureScore: 52,
    narrativeScore: 43,
    volatility24hPct: 5.6
  }
];

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

export class SyntheticMarketDataFeed {
  constructor({ state, logger }) {
    this.state = state;
    this.logger = logger;
    this.marketState = new Map();
    this.tick = 0;
    this.ready = false;
  }

  getMetadata() {
    return {
      provider: "synthetic",
      symbols: [...this.marketState.keys()]
    };
  }

  async ensureLoaded() {
    if (this.ready) {
      return;
    }

    const saved = await this.state.readJson("market-state.json", {
      tick: 0,
      markets: BASE_MARKETS
    });
    this.tick = saved.tick;
    this.marketState = new Map(saved.markets.map((market) => [market.symbol, { ...market }]));
    this.ready = true;
  }

  async persist() {
    await this.state.writeJson("market-state.json", {
      tick: this.tick,
      markets: [...this.marketState.values()]
    });
  }

  driftFor(market, index) {
    const phase = this.tick + index * 0.7;
    const signalDrift = (market.trendScore + market.momentumScore) / 10000;
    const oscillation = Math.sin(phase) * (market.volatility24hPct / 900);
    return signalDrift + oscillation;
  }

  mutateMarket(market, index) {
    const drift = this.driftFor(market, index);
    const lastPrice = round(market.lastPrice * (1 + drift), market.lastPrice < 1 ? 6 : 4);
    const fundingShift = Math.sin((this.tick + index) / 3) * 0.0025;
    const momentumShift = Math.cos((this.tick + index) / 2) * 4;
    const trendShift = Math.sin((this.tick + index) / 4) * 3;

    return {
      ...market,
      lastPrice,
      fundingRatePct: round(market.fundingRatePct + fundingShift, 3),
      momentumScore: Math.max(-60, Math.min(60, round(market.momentumScore + momentumShift, 0))),
      trendScore: Math.max(-60, Math.min(60, round(market.trendScore + trendShift, 0))),
      spreadBps: round(Math.max(0.8, market.spreadBps + Math.cos(this.tick + index) * 0.4), 2)
    };
  }

  async snapshotAll() {
    await this.ensureLoaded();
    const markets = [];
    let index = 0;
    for (const market of this.marketState.values()) {
      const next = this.mutateMarket(market, index);
      this.marketState.set(next.symbol, next);
      markets.push(next);
      index += 1;
    }
    this.tick += 1;
    await this.persist();
    return markets;
  }

  async getMarketUniverse() {
    return this.snapshotAll();
  }

  async getQuote(symbol) {
    await this.ensureLoaded();
    const market = this.marketState.get(symbol);
    if (!market) {
      throw new Error(`Unknown market symbol: ${symbol}`);
    }
    const refreshed = this.mutateMarket(market, 0);
    this.marketState.set(symbol, refreshed);
    this.tick += 1;
    await this.persist();
    return {
      symbol: refreshed.symbol,
      markPrice: refreshed.lastPrice,
      spreadBps: refreshed.spreadBps,
      fundingRatePct: refreshed.fundingRatePct,
      timestamp: new Date().toISOString()
    };
  }

  async getQuotes(symbols) {
    const quotes = await Promise.all(
      symbols.map(async (symbol) => [symbol, await this.getQuote(symbol)])
    );
    return Object.fromEntries(quotes);
  }
}
