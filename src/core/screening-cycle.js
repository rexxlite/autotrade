import { buildScreenerPrompt } from "./prompts.js";

export class ScreeningCycle {
  constructor({ agent, screener, strategyLibrary, toolExecutor, lessons, logger }) {
    this.agent = agent;
    this.screener = screener;
    this.strategyLibrary = strategyLibrary;
    this.toolExecutor = toolExecutor;
    this.lessons = lessons;
    this.logger = logger;
  }

  async run() {
    const cycleId = `screen_${Date.now()}`;
    const markets = await this.toolExecutor.getMarketSnapshot();
    const candidates = await this.screener.screen(markets);
    const account = await this.toolExecutor.paperExchange.getAccount();
    const lessonsSummary = await this.lessons.getSummary();
    const strategy = this.strategyLibrary.getActiveStrategy();
    const promptPreview = buildScreenerPrompt({ account, candidates, lessonsSummary, strategy });

    this.logger.info("Screening cycle started", {
      cycleId,
      marketsSeen: markets.length,
      candidates: candidates.length
    });

    const decision = this.agent.decideScreeningAction({ candidates, account, lessonsSummary });
    if (decision.action === "NO_TRADE") {
      await this.toolExecutor.state.recordDecision({
        cycleId,
        role: "SCREENER",
        action: "NO_TRADE",
        reason: decision.reasoning,
        promptPreview,
        timestamp: new Date().toISOString()
      });
      return {
        cycleId,
        decision
      };
    }

    const execution = await this.toolExecutor.openPaperPosition({
      candidate: decision.candidate,
      strategyPlan: decision.strategyPlan,
      reasoning: decision.reasoning,
      cycleId
    });

    return {
      cycleId,
      promptPreview,
      decision,
      execution
    };
  }
}
