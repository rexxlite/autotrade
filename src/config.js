import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toList(value, fallback = []) {
  if (value === undefined) {
    return fallback;
  }

  return String(value)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export function createConfig() {
  const bybitTestnet = toBoolean(process.env.BYBIT_TESTNET, false);
  const bybitBaseUrl =
    process.env.BYBIT_REST_BASE_URL ||
    (bybitTestnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com");

  return {
    botName: process.env.BOT_NAME || "Meridian Futures Paper",
    logLevel: process.env.LOG_LEVEL || "info",
    dataDir: path.resolve(process.cwd(), "data"),
    marketData: {
      provider: (process.env.MARKET_DATA_PROVIDER || "bybit").toLowerCase()
    },
    scheduler: {
      screenCron: process.env.SCREEN_INTERVAL_CRON || "*/30 * * * *",
      manageCron: process.env.MANAGEMENT_INTERVAL_CRON || "*/5 * * * *",
      runScreenOnStart: toBoolean(process.env.RUN_SCREEN_ON_START, true),
      runManageOnStart: toBoolean(process.env.RUN_MANAGE_ON_START, true)
    },
    trading: {
      startingBalanceUsdt: toNumber(process.env.STARTING_BALANCE_USDT, 10000),
      defaultLeverage: toNumber(process.env.DEFAULT_LEVERAGE, 2),
      maxLeverage: toNumber(process.env.MAX_LEVERAGE, 3),
      maxOpenPositions: toNumber(process.env.MAX_OPEN_POSITIONS, 3),
      maxDailyLossUsdt: toNumber(process.env.MAX_DAILY_LOSS_USDT, 250),
      maxNotionalPerTrade: toNumber(process.env.MAX_NOTIONAL_PER_TRADE, 1500),
      riskPerTradePct: toNumber(process.env.RISK_PER_TRADE_PCT, 0.75),
      stopLossPct: toNumber(process.env.STOP_LOSS_PCT, 1.2),
      takeProfitPct: toNumber(process.env.TAKE_PROFIT_PCT, 2.4),
      trailingStopPct: toNumber(process.env.TRAILING_STOP_PCT, 0.8),
      maxHoldingMinutes: toNumber(process.env.MAX_HOLDING_MINUTES, 360)
    },
    screening: {
      minVolumeUsdt: toNumber(process.env.MIN_VOLUME_USDT, 25000000),
      minOpenInterestUsdt: toNumber(process.env.MIN_OPEN_INTEREST_USDT, 10000000),
      maxSpreadBps: toNumber(process.env.MAX_SPREAD_BPS, 6),
      maxFundingAbsPct: toNumber(process.env.MAX_FUNDING_ABS_PCT, 0.04),
      minSignalStrength: toNumber(process.env.MIN_SIGNAL_STRENGTH, 45),
      topCandidates: toNumber(process.env.TOP_CANDIDATES, 5)
    },
    bybit: {
      testnet: bybitTestnet,
      restBaseUrl: bybitBaseUrl,
      category: process.env.BYBIT_CATEGORY || "linear",
      symbols: toList(process.env.BYBIT_SYMBOLS, [
        "BTCUSDT",
        "ETHUSDT",
        "SOLUSDT",
        "XRPUSDT",
        "DOGEUSDT",
        "WIFUSDT",
        "ADAUSDT",
        "ARBUSDT"
      ]),
      maxSymbols: toNumber(process.env.BYBIT_MAX_SYMBOLS, 12),
      klineInterval: process.env.BYBIT_KLINE_INTERVAL || "60",
      klineLimit: toNumber(process.env.BYBIT_KLINE_LIMIT, 24),
      timeoutMs: toNumber(process.env.BYBIT_TIMEOUT_MS, 10000)
    }
  };
}
