import { createBotApp } from "./index.js";

function printJson(label, value) {
  console.log(`\n${label}`);
  console.log(JSON.stringify(value, null, 2));
}

async function showStatus(app) {
  const [account, positions, metrics, lessons, journal] = await Promise.all([
    app.paperExchange.getAccount(),
    app.paperExchange.getOpenPositions(),
    app.state.getMetrics(),
    app.lessons.getSummary(),
    app.journal.getRecentEvents(10)
  ]);

  printJson("Account", account);
  printJson("Market Data Provider", app.marketDataFeed.getMetadata());
  printJson("Open Positions", positions);
  printJson("Metrics", metrics);
  printJson("Lessons", lessons);
  printJson("Recent Journal", journal);
}

async function showMarketSnapshot(app) {
  const snapshot = await app.toolExecutor.getMarketSnapshot();
  printJson("Market Snapshot", {
    provider: app.marketDataFeed.getMetadata(),
    markets: snapshot
  });
}

async function startScheduler(app) {
  if (app.config.scheduler.runScreenOnStart) {
    await app.screeningCycle.run();
  }
  if (app.config.scheduler.runManageOnStart) {
    await app.managementCycle.run();
  }
  app.scheduler.start();
}

async function flattenPositions(app) {
  const openPositions = await app.paperExchange.getOpenPositions();
  if (openPositions.length === 0) {
    printJson("Flatten", { closedTrades: [], message: "No open positions." });
    return;
  }

  const quotesBySymbol = await app.marketDataFeed.getQuotes(openPositions.map((position) => position.symbol));
  const closedTrades = [];
  for (const position of openPositions) {
    const result = await app.toolExecutor.closePaperPosition({
      positionId: position.id,
      exitPrice: quotesBySymbol[position.symbol].markPrice,
      reason: "MANUAL_FLATTEN",
      cycleId: `flatten_${Date.now()}`
    });
    closedTrades.push(result.closedTrade);
  }

  printJson("Flatten", { closedTrades });
}

async function main() {
  const command = process.argv[2] || "start";
  const app = await createBotApp();

  if (command === "screen") {
    printJson("Screening Cycle", await app.screeningCycle.run());
    return;
  }

  if (command === "manage") {
    printJson("Management Cycle", await app.managementCycle.run());
    return;
  }

  if (command === "status") {
    await showStatus(app);
    return;
  }

  if (command === "market") {
    await showMarketSnapshot(app);
    return;
  }

  if (command === "flatten") {
    await flattenPositions(app);
    return;
  }

  if (command === "start") {
    await startScheduler(app);
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
