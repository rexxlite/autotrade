export class FuturesAgent {
  constructor({ logger, strategyLibrary }) {
    this.logger = logger;
    this.strategyLibrary = strategyLibrary;
  }

  decideScreeningAction({ candidates, account, lessonsSummary }) {
    const strategy = this.strategyLibrary.getActiveStrategy();
    if (candidates.length === 0) {
      return {
        action: "NO_TRADE",
        reasoning: "No candidates passed deterministic screening."
      };
    }

    const scoredPlans = candidates.map((candidate) => {
      const plan = this.strategyLibrary.buildPlan(candidate);
      const lessonBoost = candidate.lessonBias || 0;
      const convictionScore = candidate.screenScore + lessonBoost + plan.conviction * 10;
      return { candidate, plan, convictionScore };
    });

    scoredPlans.sort((left, right) => right.convictionScore - left.convictionScore);
    const best = scoredPlans[0];

    return {
      action: "OPEN_POSITION",
      candidate: best.candidate,
      strategyPlan: best.plan,
      promptPreview: {
        accountFreeBalanceUsdt: account.freeBalanceUsdt,
        strategy: strategy.name,
        candidateCount: candidates.length
      },
      reasoning: `Selected ${best.candidate.symbol} ${best.plan.side} from ${candidates.length} screened markets with combined conviction ${best.convictionScore.toFixed(2)}.`
    };
  }

  summarizeManagement({ exits, positions }) {
    if (positions.length === 0) {
      return "No open positions to manage.";
    }
    if (exits.length === 0) {
      return `Holding ${positions.length} open position(s); no exit trigger fired.`;
    }
    return `Prepared ${exits.length} exit(s) from ${positions.length} open position(s).`;
  }
}
