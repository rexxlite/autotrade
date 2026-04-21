function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

export class ToolExecutor {
  constructor({ marketDataFeed, paperExchange, riskEngine, state, journal, lessons, logger }) {
    this.marketDataFeed = marketDataFeed;
    this.paperExchange = paperExchange;
    this.riskEngine = riskEngine;
    this.state = state;
    this.journal = journal;
    this.lessons = lessons;
    this.logger = logger;
  }

  async getRiskState() {
    const account = await this.paperExchange.getAccount();
    const openPositions = await this.paperExchange.getOpenPositions();
    return this.riskEngine.getRiskState({ account, openPositions });
  }

  async getMarketSnapshot() {
    return this.marketDataFeed.getMarketUniverse();
  }

  async getOpenPositions() {
    return this.paperExchange.getOpenPositions();
  }

  async openPaperPosition({ candidate, strategyPlan, reasoning, cycleId }) {
    const account = await this.paperExchange.getAccount();
    const openPositions = await this.paperExchange.getOpenPositions();
    const validation = this.riskEngine.validateEntry({ account, openPositions, candidate, strategyPlan });
    if (!validation.ok) {
      await this.state.recordDecision({
        cycleId,
        role: "SCREENER",
        action: "NO_TRADE",
        symbol: candidate.symbol,
        reason: validation.reason,
        timestamp: new Date().toISOString()
      });
      return { executed: false, reason: validation.reason };
    }

    const quote = await this.marketDataFeed.getQuote(candidate.symbol);
    const planResult = this.riskEngine.buildPositionPlan({ account, candidate, strategyPlan, quote });
    if (!planResult.ok) {
      await this.state.recordDecision({
        cycleId,
        role: "SCREENER",
        action: "NO_TRADE",
        symbol: candidate.symbol,
        reason: planResult.reason,
        timestamp: new Date().toISOString()
      });
      return { executed: false, reason: planResult.reason };
    }

    const position = await this.paperExchange.openPosition(planResult.plan);
    await this.journal.recordOpen(position);
    await this.state.recordDecision({
      cycleId,
      role: "SCREENER",
      action: "OPEN_POSITION",
      symbol: position.symbol,
      side: position.side,
      notionalUsdt: position.notionalUsdt,
      reasoning,
      timestamp: new Date().toISOString()
    });

    return { executed: true, position };
  }

  async closePaperPosition({ positionId, exitPrice, reason, cycleId }) {
    const closedTrade = await this.paperExchange.closePosition({
      positionId,
      exitPrice,
      closeReason: reason
    });

    await this.updateMetrics(closedTrade);
    await this.journal.recordClose(closedTrade);
    await this.lessons.learnFromTrade(closedTrade);
    await this.state.recordDecision({
      cycleId,
      role: "MANAGER",
      action: "CLOSE_POSITION",
      symbol: closedTrade.symbol,
      side: closedTrade.side,
      pnlUsdt: closedTrade.realizedPnlUsdt,
      reason,
      timestamp: new Date().toISOString()
    });

    return { executed: true, closedTrade };
  }

  async updateMetrics(closedTrade) {
    const metrics = await this.state.getMetrics();
    metrics.totalTrades += 1;
    metrics.netPnlUsdt = round(metrics.netPnlUsdt + closedTrade.realizedPnlUsdt);
    if (closedTrade.realizedPnlUsdt >= 0) {
      metrics.wins += 1;
      metrics.biggestWinUsdt = Math.max(metrics.biggestWinUsdt, closedTrade.realizedPnlUsdt);
    } else {
      metrics.losses += 1;
      metrics.biggestLossUsdt = Math.min(metrics.biggestLossUsdt, closedTrade.realizedPnlUsdt);
    }
    await this.state.saveMetrics(metrics);
  }
}
