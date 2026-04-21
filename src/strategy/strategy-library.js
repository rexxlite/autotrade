export class StrategyLibrary {
  constructor({ config }) {
    this.config = config;
    this.activeStrategyId = "trend-pullback";
  }

  getActiveStrategy() {
    return {
      id: "trend-pullback",
      name: "Trend Pullback",
      description: "Masuk ketika trend dominan searah dengan momentum dan funding belum terlalu crowded."
    };
  }

  listStrategies() {
    return [
      this.getActiveStrategy(),
      {
        id: "funding-fade",
        name: "Funding Fade",
        description: "Kontra crowd pada funding ekstrem dengan size lebih kecil."
      }
    ];
  }

  buildPlan(candidate) {
    const signal = candidate.signalStrength;
    const direction = candidate.directionHint;
    const leverage = Math.min(
      this.config.trading.maxLeverage,
      Math.max(1, signal >= 72 ? this.config.trading.defaultLeverage + 1 : this.config.trading.defaultLeverage)
    );

    return {
      strategyId: this.activeStrategyId,
      side: direction,
      conviction: Number((candidate.screenScore / 100).toFixed(2)),
      leverage,
      stopLossPct: this.config.trading.stopLossPct,
      takeProfitPct: this.config.trading.takeProfitPct,
      trailingStopPct: this.config.trading.trailingStopPct,
      maxHoldingMinutes: this.config.trading.maxHoldingMinutes,
      thesis: `${direction} ${candidate.symbol} karena trend ${candidate.trendScore}, momentum ${candidate.momentumScore}, dan score screening ${candidate.screenScore}.`
    };
  }
}
