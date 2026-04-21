function nowIso() {
  return new Date().toISOString();
}

function calculatePnl(side, entryPrice, exitPrice, quantity) {
  const directionalMove = side === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return directionalMove * quantity;
}

export class PaperExchange {
  constructor({ state, logger }) {
    this.state = state;
    this.logger = logger;
  }

  async ensureAccount(startingBalanceUsdt) {
    return this.state.initializeAccountIfMissing(startingBalanceUsdt);
  }

  async getAccount() {
    return this.state.getAccount();
  }

  async getOpenPositions() {
    return this.state.getOpenPositions();
  }

  async saveOpenPositions(positions) {
    await this.state.saveOpenPositions(positions);
  }

  async resetDailyLossIfNeeded(date = new Date()) {
    const account = await this.state.getAccount();
    const resetDate = date.toISOString().slice(0, 10);
    if (account.lastDailyResetDate !== resetDate) {
      account.dailyLossUsdt = 0;
      account.lastDailyResetDate = resetDate;
      await this.state.saveAccount(account);
    }
    return account;
  }

  async openPosition(plan) {
    const account = await this.resetDailyLossIfNeeded();
    const positions = await this.state.getOpenPositions();
    if (account.freeBalanceUsdt < plan.marginUsedUsdt) {
      throw new Error("Insufficient free balance for simulated margin");
    }

    const position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      openedAt: nowIso(),
      updatedAt: nowIso(),
      symbol: plan.symbol,
      side: plan.side,
      strategyId: plan.strategyId,
      entryPrice: plan.entryPrice,
      markPrice: plan.entryPrice,
      quantity: plan.quantity,
      leverage: plan.leverage,
      notionalUsdt: plan.notionalUsdt,
      marginUsedUsdt: plan.marginUsedUsdt,
      unrealizedPnlUsdt: 0,
      stopLossPrice: plan.stopLossPrice,
      takeProfitPrice: plan.takeProfitPrice,
      trailingStopPct: plan.trailingStopPct,
      maxHoldingMinutes: plan.maxHoldingMinutes,
      peakPrice: plan.entryPrice,
      troughPrice: plan.entryPrice,
      screenScore: plan.screenScore,
      thesis: plan.thesis
    };

    positions.push(position);
    account.freeBalanceUsdt = Number((account.freeBalanceUsdt - plan.marginUsedUsdt).toFixed(2));
    account.usedMarginUsdt = Number((account.usedMarginUsdt + plan.marginUsedUsdt).toFixed(2));
    account.equityUsdt = Number((account.freeBalanceUsdt + account.usedMarginUsdt).toFixed(2));

    await this.state.saveOpenPositions(positions);
    await this.state.saveAccount(account);
    return position;
  }

  async markToMarket(quotesBySymbol) {
    const account = await this.resetDailyLossIfNeeded();
    const positions = await this.state.getOpenPositions();
    let unrealizedTotal = 0;

    for (const position of positions) {
      const quote = quotesBySymbol[position.symbol];
      if (!quote) {
        continue;
      }
      position.markPrice = quote.markPrice;
      position.updatedAt = nowIso();
      position.unrealizedPnlUsdt = Number(
        calculatePnl(position.side, position.entryPrice, position.markPrice, position.quantity).toFixed(2)
      );
      position.peakPrice = position.side === "LONG" ? Math.max(position.peakPrice, position.markPrice) : position.peakPrice;
      position.troughPrice = position.side === "SHORT" ? Math.min(position.troughPrice, position.markPrice) : position.troughPrice;
      unrealizedTotal += position.unrealizedPnlUsdt;
    }

    account.equityUsdt = Number((account.freeBalanceUsdt + account.usedMarginUsdt + unrealizedTotal).toFixed(2));
    await this.state.saveOpenPositions(positions);
    await this.state.saveAccount(account);

    return { account, positions };
  }

  async closePosition({ positionId, exitPrice, closeReason }) {
    const account = await this.resetDailyLossIfNeeded();
    const positions = await this.state.getOpenPositions();
    const index = positions.findIndex((position) => position.id === positionId);
    if (index === -1) {
      throw new Error(`Unknown position id: ${positionId}`);
    }

    const [position] = positions.splice(index, 1);
    const realizedPnlUsdt = Number(
      calculatePnl(position.side, position.entryPrice, exitPrice, position.quantity).toFixed(2)
    );
    const releasedBalance = position.marginUsedUsdt + realizedPnlUsdt;

    account.freeBalanceUsdt = Number((account.freeBalanceUsdt + releasedBalance).toFixed(2));
    account.usedMarginUsdt = Number((account.usedMarginUsdt - position.marginUsedUsdt).toFixed(2));
    account.realizedPnlUsdt = Number((account.realizedPnlUsdt + realizedPnlUsdt).toFixed(2));
    account.balanceUsdt = Number((account.balanceUsdt + realizedPnlUsdt).toFixed(2));
    if (realizedPnlUsdt < 0) {
      account.dailyLossUsdt = Number((account.dailyLossUsdt + Math.abs(realizedPnlUsdt)).toFixed(2));
    }
    account.equityUsdt = Number((account.freeBalanceUsdt + account.usedMarginUsdt).toFixed(2));

    await this.state.saveOpenPositions(positions);
    await this.state.saveAccount(account);

    return {
      ...position,
      closedAt: nowIso(),
      exitPrice,
      realizedPnlUsdt,
      closeReason
    };
  }
}
