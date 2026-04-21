function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

export class RiskEngine {
  constructor({ config }) {
    this.config = config;
  }

  getRiskState({ account, openPositions }) {
    return {
      dailyLossRemainingUsdt: round(this.config.trading.maxDailyLossUsdt - account.dailyLossUsdt, 2),
      availableSlots: this.config.trading.maxOpenPositions - openPositions.length,
      freeBalanceUsdt: account.freeBalanceUsdt,
      openSymbols: openPositions.map((position) => position.symbol)
    };
  }

  validateEntry({ account, openPositions, candidate, strategyPlan }) {
    if (openPositions.length >= this.config.trading.maxOpenPositions) {
      return { ok: false, reason: "Max open positions reached" };
    }
    if (openPositions.some((position) => position.symbol === candidate.symbol)) {
      return { ok: false, reason: `Existing exposure on ${candidate.symbol}` };
    }
    if (account.dailyLossUsdt >= this.config.trading.maxDailyLossUsdt) {
      return { ok: false, reason: "Daily loss limit reached" };
    }
    if (strategyPlan.leverage > this.config.trading.maxLeverage) {
      return { ok: false, reason: "Leverage above configured limit" };
    }
    if (candidate.screenScore < this.config.screening.minSignalStrength) {
      return { ok: false, reason: "Screen score below execution threshold" };
    }
    return { ok: true };
  }

  buildPositionPlan({ account, candidate, strategyPlan, quote }) {
    const riskBudgetUsdt = account.balanceUsdt * (this.config.trading.riskPerTradePct / 100);
    const stopLossMovePct = strategyPlan.stopLossPct / 100;
    const rawNotionalUsdt = riskBudgetUsdt / stopLossMovePct;
    const cappedNotionalUsdt = Math.min(
      rawNotionalUsdt,
      this.config.trading.maxNotionalPerTrade,
      account.freeBalanceUsdt * strategyPlan.leverage
    );

    const notionalUsdt = round(Math.max(0, cappedNotionalUsdt), 2);
    if (notionalUsdt <= 0) {
      return { ok: false, reason: "No notional budget available for new position" };
    }

    const marginUsedUsdt = round(notionalUsdt / strategyPlan.leverage, 2);
    if (marginUsedUsdt > account.freeBalanceUsdt) {
      return { ok: false, reason: "Margin requirement exceeds free balance" };
    }

    const quantity = round(notionalUsdt / quote.markPrice, quote.markPrice < 1 ? 2 : 5);
    if (quantity <= 0) {
      return { ok: false, reason: "Position size rounded to zero" };
    }

    const stopLossDistance = quote.markPrice * stopLossMovePct;
    const takeProfitDistance = quote.markPrice * (strategyPlan.takeProfitPct / 100);
    const stopLossPrice =
      strategyPlan.side === "LONG"
        ? round(quote.markPrice - stopLossDistance, quote.markPrice < 1 ? 6 : 4)
        : round(quote.markPrice + stopLossDistance, quote.markPrice < 1 ? 6 : 4);
    const takeProfitPrice =
      strategyPlan.side === "LONG"
        ? round(quote.markPrice + takeProfitDistance, quote.markPrice < 1 ? 6 : 4)
        : round(quote.markPrice - takeProfitDistance, quote.markPrice < 1 ? 6 : 4);

    return {
      ok: true,
      plan: {
        symbol: candidate.symbol,
        side: strategyPlan.side,
        strategyId: strategyPlan.strategyId,
        leverage: strategyPlan.leverage,
        quantity,
        entryPrice: quote.markPrice,
        notionalUsdt,
        marginUsedUsdt,
        stopLossPrice,
        takeProfitPrice,
        trailingStopPct: strategyPlan.trailingStopPct,
        maxHoldingMinutes: strategyPlan.maxHoldingMinutes,
        screenScore: candidate.screenScore,
        thesis: strategyPlan.thesis
      }
    };
  }
}
