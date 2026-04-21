export class TradeJournal {
  constructor({ state, logger }) {
    this.state = state;
    this.logger = logger;
  }

  async recordOpen(position) {
    await this.state.appendJournalEvent({
      type: "POSITION_OPENED",
      timestamp: new Date().toISOString(),
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      notionalUsdt: position.notionalUsdt,
      leverage: position.leverage,
      thesis: position.thesis
    });
  }

  async recordClose(closedTrade) {
    await this.state.appendJournalEvent({
      type: "POSITION_CLOSED",
      timestamp: new Date().toISOString(),
      positionId: closedTrade.id,
      symbol: closedTrade.symbol,
      side: closedTrade.side,
      entryPrice: closedTrade.entryPrice,
      exitPrice: closedTrade.exitPrice,
      pnlUsdt: closedTrade.realizedPnlUsdt,
      closeReason: closedTrade.closeReason
    });
  }

  async recordEvent(type, payload) {
    await this.state.appendJournalEvent({
      type,
      timestamp: new Date().toISOString(),
      ...payload
    });
  }

  async getRecentEvents(limit = 20) {
    return this.state.getJournal(limit);
  }
}
