import { buildManagerPrompt } from "./prompts.js";

export class ManagementCycle {
  constructor({ agent, positionManager, toolExecutor, logger }) {
    this.agent = agent;
    this.positionManager = positionManager;
    this.toolExecutor = toolExecutor;
    this.logger = logger;
  }

  async run() {
    const cycleId = `manage_${Date.now()}`;
    const openPositions = await this.toolExecutor.getOpenPositions();
    if (openPositions.length === 0) {
      return {
        cycleId,
        positionsManaged: 0,
        exits: []
      };
    }

    const quotesBySymbol = await this.toolExecutor.marketDataFeed.getQuotes(
      openPositions.map((position) => position.symbol)
    );
    await this.toolExecutor.paperExchange.markToMarket(quotesBySymbol);
    const refreshedPositions = await this.toolExecutor.getOpenPositions();
    const evaluation = this.positionManager.evaluate(refreshedPositions, quotesBySymbol);
    await this.toolExecutor.paperExchange.saveOpenPositions(evaluation.nextPositions);

    const riskState = await this.toolExecutor.getRiskState();
    const promptPreview = buildManagerPrompt({ positions: refreshedPositions, riskState });
    const summary = this.agent.summarizeManagement({
      exits: evaluation.exits,
      positions: refreshedPositions
    });

    const closedTrades = [];
    for (const exit of evaluation.exits) {
      const result = await this.toolExecutor.closePaperPosition({
        positionId: exit.positionId,
        exitPrice: exit.exitPrice,
        reason: exit.reason,
        cycleId
      });
      closedTrades.push(result.closedTrade);
    }

    this.logger.info("Management cycle completed", {
      cycleId,
      positionsManaged: refreshedPositions.length,
      exits: evaluation.exits.length
    });

    return {
      cycleId,
      promptPreview,
      summary,
      positionsManaged: refreshedPositions.length,
      exits: evaluation.exits,
      closedTrades
    };
  }
}
