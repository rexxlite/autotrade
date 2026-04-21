function getSymbolBucket(store, symbol) {
  if (!store[symbol]) {
    store[symbol] = { trades: 0, wins: 0, netPnlUsdt: 0, avgPnlUsdt: 0 };
  }
  return store[symbol];
}

function updateAvg(bucket) {
  bucket.avgPnlUsdt = bucket.trades === 0 ? 0 : bucket.netPnlUsdt / bucket.trades;
}

export class LessonsMemory {
  constructor({ state, logger }) {
    this.state = state;
    this.logger = logger;
  }

  async getSummary() {
    const lessons = await this.state.getLessonsData();
    const topSymbols = Object.entries(lessons.symbolStats)
      .sort((left, right) => right[1].netPnlUsdt - left[1].netPnlUsdt)
      .slice(0, 5)
      .map(([symbol, stats]) => ({
        symbol,
        trades: stats.trades,
        wins: stats.wins,
        winRatePct: stats.trades === 0 ? 0 : Number(((stats.wins / stats.trades) * 100).toFixed(1)),
        avgPnlUsdt: Number(stats.avgPnlUsdt.toFixed(2))
      }));

    return {
      topSymbols,
      sideStats: lessons.sideStats,
      lastUpdatedAt: lessons.lastUpdatedAt
    };
  }

  async getBias(symbol, side) {
    const lessons = await this.state.getLessonsData();
    const symbolStats = lessons.symbolStats[symbol];
    const sideStats = lessons.sideStats[side];
    const symbolBias = symbolStats && symbolStats.trades >= 2 ? symbolStats.avgPnlUsdt / 25 : 0;
    const sideBias = sideStats && sideStats.trades >= 2 ? sideStats.netPnlUsdt / 200 : 0;
    return Number((symbolBias + sideBias).toFixed(2));
  }

  async learnFromTrade(closedTrade) {
    const lessons = await this.state.getLessonsData();
    const symbolBucket = getSymbolBucket(lessons.symbolStats, closedTrade.symbol);
    symbolBucket.trades += 1;
    symbolBucket.netPnlUsdt += closedTrade.realizedPnlUsdt;
    if (closedTrade.realizedPnlUsdt > 0) {
      symbolBucket.wins += 1;
    }
    updateAvg(symbolBucket);

    const sideBucket = lessons.sideStats[closedTrade.side];
    sideBucket.trades += 1;
    sideBucket.netPnlUsdt += closedTrade.realizedPnlUsdt;
    if (closedTrade.realizedPnlUsdt > 0) {
      sideBucket.wins += 1;
    }

    lessons.lastUpdatedAt = new Date().toISOString();
    await this.state.saveLessonsData(lessons);
  }
}
