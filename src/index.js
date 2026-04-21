import { createConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { RuntimeState } from "./state/store.js";
import { TradeJournal } from "./journal/trade-journal.js";
import { LessonsMemory } from "./memory/lessons.js";
import { StrategyLibrary } from "./strategy/strategy-library.js";
import { MarketScreener } from "./strategy/market-screener.js";
import { createMarketDataFeed } from "./exchange/market-data-feed.js";
import { PaperExchange } from "./exchange/paper-exchange.js";
import { RiskEngine } from "./risk/risk-engine.js";
import { FuturesAgent } from "./core/agent.js";
import { ToolExecutor } from "./core/tool-executor.js";
import { PositionManager } from "./portfolio/position-manager.js";
import { ScreeningCycle } from "./core/screening-cycle.js";
import { ManagementCycle } from "./core/management-cycle.js";
import { BotScheduler } from "./core/scheduler.js";

export async function createBotApp() {
  const config = createConfig();
  const logger = createLogger("paper-futures-bot", config.logLevel);
  const state = new RuntimeState({ dataDir: config.dataDir, logger });
  await state.ensure();

  const journal = new TradeJournal({ state, logger });
  const lessons = new LessonsMemory({ state, logger });
  const strategyLibrary = new StrategyLibrary({ config });
  const marketDataFeed = createMarketDataFeed({ config, state, logger });
  const paperExchange = new PaperExchange({ state, logger });
  await paperExchange.ensureAccount(config.trading.startingBalanceUsdt);

  const riskEngine = new RiskEngine({ config });
  const agent = new FuturesAgent({ logger, strategyLibrary });
  const screener = new MarketScreener({ config, lessons });
  const positionManager = new PositionManager();
  const toolExecutor = new ToolExecutor({
    marketDataFeed,
    paperExchange,
    riskEngine,
    state,
    journal,
    lessons,
    logger
  });

  const screeningCycle = new ScreeningCycle({
    agent,
    screener,
    strategyLibrary,
    toolExecutor,
    lessons,
    logger
  });

  const managementCycle = new ManagementCycle({
    agent,
    positionManager,
    toolExecutor,
    logger
  });

  const scheduler = new BotScheduler({
    config,
    screeningCycle,
    managementCycle,
    logger
  });

  return {
    config,
    logger,
    state,
    journal,
    lessons,
    marketDataFeed,
    paperExchange,
    riskEngine,
    toolExecutor,
    strategyLibrary,
    screeningCycle,
    managementCycle,
    scheduler
  };
}
