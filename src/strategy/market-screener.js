function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreMarket(market) {
  const directionSignal = market.trendScore + market.momentumScore;
  const strength = Math.abs(directionSignal);
  const liquidityComponent = clamp(market.liquidityScore, 0, 100) * 0.18;
  const structureComponent = clamp(market.structureScore, 0, 100) * 0.14;
  const narrativeComponent = clamp(market.narrativeScore, 0, 100) * 0.08;
  const volumeComponent = clamp(market.volume24hUsdt / 600000, 0, 25);
  const oiComponent = clamp(market.openInterestUsdt / 400000, 0, 20);
  const signalComponent = clamp(strength * 0.28, 0, 28);
  const spreadPenalty = clamp(market.spreadBps * 2, 0, 12);
  const fundingPenalty = clamp(Math.abs(market.fundingRatePct) * 200, 0, 10);
  return Number((liquidityComponent + structureComponent + narrativeComponent + volumeComponent + oiComponent + signalComponent - spreadPenalty - fundingPenalty).toFixed(2));
}

export class MarketScreener {
  constructor({ config, lessons }) {
    this.config = config;
    this.lessons = lessons;
  }

  async screen(markets) {
    const shortlisted = [];
    for (const market of markets) {
      if (market.volume24hUsdt < this.config.screening.minVolumeUsdt) {
        continue;
      }
      if (market.openInterestUsdt < this.config.screening.minOpenInterestUsdt) {
        continue;
      }
      if (market.spreadBps > this.config.screening.maxSpreadBps) {
        continue;
      }
      if (Math.abs(market.fundingRatePct) > this.config.screening.maxFundingAbsPct) {
        continue;
      }

      const signalStrength = Math.abs(market.trendScore + market.momentumScore);
      if (signalStrength < this.config.screening.minSignalStrength) {
        continue;
      }

      const candidate = {
        ...market,
        signalStrength,
        directionHint: market.trendScore + market.momentumScore >= 0 ? "LONG" : "SHORT",
        screenScore: scoreMarket(market)
      };

      const lessonBias = await this.lessons.getBias(candidate.symbol, candidate.directionHint);
      candidate.lessonBias = lessonBias;
      candidate.screenScore = Number((candidate.screenScore + lessonBias).toFixed(2));
      shortlisted.push(candidate);
    }

    return shortlisted
      .sort((left, right) => right.screenScore - left.screenScore)
      .slice(0, this.config.screening.topCandidates);
  }
}
