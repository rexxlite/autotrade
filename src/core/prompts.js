export function buildScreenerPrompt({ account, candidates, lessonsSummary, strategy }) {
  return [
    "You are the screener for a paper futures bot.",
    "Select at most one candidate for execution or return NO_TRADE.",
    "Only choose symbols with aligned trend and momentum, acceptable funding, and strong liquidity.",
    `Account free balance: ${account.freeBalanceUsdt} USDT.`,
    `Active strategy: ${strategy.name}.`,
    `Top candidates: ${candidates.map((candidate) => `${candidate.symbol}(${candidate.directionHint}, score ${candidate.screenScore})`).join(", ") || "none"}.`,
    `Recent lessons: ${JSON.stringify(lessonsSummary.topSymbols)}`
  ].join(" ");
}

export function buildManagerPrompt({ positions, riskState }) {
  return [
    "You are the manager for a paper futures bot.",
    "Protect downside first, then take profit systematically.",
    `Open positions: ${positions.map((position) => `${position.symbol}:${position.side}`).join(", ") || "none"}.`,
    `Daily loss remaining: ${riskState.dailyLossRemainingUsdt} USDT.`
  ].join(" ");
}
