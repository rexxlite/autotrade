import { BybitMarketDataFeed } from "./bybit-market-data-feed.js";
import { SyntheticMarketDataFeed } from "./synthetic-market-data-feed.js";

export function createMarketDataFeed({ config, state, logger }) {
  if (config.marketData.provider === "bybit") {
    return new BybitMarketDataFeed({ config, state, logger });
  }

  return new SyntheticMarketDataFeed({ state, logger });
}
