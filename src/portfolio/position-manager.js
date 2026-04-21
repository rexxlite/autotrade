function minutesBetween(leftIso, rightIso) {
  const deltaMs = new Date(rightIso).getTime() - new Date(leftIso).getTime();
  return deltaMs / 60000;
}

export class PositionManager {
  evaluate(positions, quotesBySymbol) {
    const nextPositions = [];
    const exits = [];
    const now = new Date().toISOString();

    for (const position of positions) {
      const quote = quotesBySymbol[position.symbol];
      if (!quote) {
        nextPositions.push(position);
        continue;
      }

      const next = {
        ...position,
        updatedAt: now,
        markPrice: quote.markPrice,
        peakPrice: position.side === "LONG" ? Math.max(position.peakPrice, quote.markPrice) : position.peakPrice,
        troughPrice: position.side === "SHORT" ? Math.min(position.troughPrice, quote.markPrice) : position.troughPrice
      };

      const holdingMinutes = minutesBetween(next.openedAt, now);
      const hitStopLoss =
        next.side === "LONG" ? quote.markPrice <= next.stopLossPrice : quote.markPrice >= next.stopLossPrice;
      const hitTakeProfit =
        next.side === "LONG" ? quote.markPrice >= next.takeProfitPrice : quote.markPrice <= next.takeProfitPrice;

      let hitTrailingStop = false;
      if (next.side === "LONG" && next.peakPrice > next.entryPrice) {
        hitTrailingStop = quote.markPrice <= next.peakPrice * (1 - next.trailingStopPct / 100);
      }
      if (next.side === "SHORT" && next.troughPrice < next.entryPrice) {
        hitTrailingStop = quote.markPrice >= next.troughPrice * (1 + next.trailingStopPct / 100);
      }

      if (hitStopLoss) {
        nextPositions.push(next);
        exits.push({ positionId: next.id, symbol: next.symbol, exitPrice: quote.markPrice, reason: "STOP_LOSS" });
        continue;
      }
      if (hitTakeProfit) {
        nextPositions.push(next);
        exits.push({ positionId: next.id, symbol: next.symbol, exitPrice: quote.markPrice, reason: "TAKE_PROFIT" });
        continue;
      }
      if (hitTrailingStop) {
        nextPositions.push(next);
        exits.push({ positionId: next.id, symbol: next.symbol, exitPrice: quote.markPrice, reason: "TRAILING_STOP" });
        continue;
      }
      if (holdingMinutes >= next.maxHoldingMinutes) {
        nextPositions.push(next);
        exits.push({ positionId: next.id, symbol: next.symbol, exitPrice: quote.markPrice, reason: "MAX_HOLDING_TIME" });
        continue;
      }

      nextPositions.push(next);
    }

    return { nextPositions, exits };
  }
}
