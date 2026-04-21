import fs from "node:fs/promises";
import path from "node:path";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class RuntimeState {
  constructor({ dataDir, logger }) {
    this.dataDir = dataDir;
    this.logger = logger;
  }

  filePath(name) {
    return path.join(this.dataDir, name);
  }

  async ensure() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.readJson("account.json", null);
    await this.readJson("positions.json", []);
    await this.readJson("decisions.json", []);
    await this.readJson("metrics.json", this.defaultMetrics());
    await this.readJson("lessons.json", this.defaultLessons());
    await this.readJson("journal.json", []);
  }

  async readJson(name, fallback) {
    const filePath = this.filePath(name);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await this.writeJson(name, fallback);
      return clone(fallback);
    }
  }

  async writeJson(name, value) {
    await fs.mkdir(this.dataDir, { recursive: true });
    const filePath = this.filePath(name);
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  defaultMetrics() {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      netPnlUsdt: 0,
      biggestWinUsdt: 0,
      biggestLossUsdt: 0
    };
  }

  defaultLessons() {
    return {
      symbolStats: {},
      sideStats: {
        LONG: { trades: 0, wins: 0, netPnlUsdt: 0 },
        SHORT: { trades: 0, wins: 0, netPnlUsdt: 0 }
      },
      lastUpdatedAt: null
    };
  }

  async initializeAccountIfMissing(startingBalanceUsdt) {
    const account = await this.readJson("account.json", null);
    if (account) {
      return account;
    }
    const fresh = {
      balanceUsdt: startingBalanceUsdt,
      freeBalanceUsdt: startingBalanceUsdt,
      usedMarginUsdt: 0,
      equityUsdt: startingBalanceUsdt,
      realizedPnlUsdt: 0,
      dailyLossUsdt: 0,
      lastDailyResetDate: new Date().toISOString().slice(0, 10)
    };
    await this.writeJson("account.json", fresh);
    return fresh;
  }

  async getAccount() {
    return this.readJson("account.json", null);
  }

  async saveAccount(account) {
    await this.writeJson("account.json", account);
  }

  async getOpenPositions() {
    return this.readJson("positions.json", []);
  }

  async saveOpenPositions(positions) {
    await this.writeJson("positions.json", positions);
  }

  async recordDecision(entry) {
    const decisions = await this.readJson("decisions.json", []);
    decisions.unshift(entry);
    await this.writeJson("decisions.json", decisions.slice(0, 200));
  }

  async getRecentDecisions(limit = 20) {
    const decisions = await this.readJson("decisions.json", []);
    return decisions.slice(0, limit);
  }

  async getMetrics() {
    return this.readJson("metrics.json", this.defaultMetrics());
  }

  async saveMetrics(metrics) {
    await this.writeJson("metrics.json", metrics);
  }

  async getLessonsData() {
    return this.readJson("lessons.json", this.defaultLessons());
  }

  async saveLessonsData(lessons) {
    await this.writeJson("lessons.json", lessons);
  }

  async appendJournalEvent(entry) {
    const journal = await this.readJson("journal.json", []);
    journal.unshift(entry);
    await this.writeJson("journal.json", journal.slice(0, 500));
  }

  async getJournal(limit = 50) {
    const journal = await this.readJson("journal.json", []);
    return journal.slice(0, limit);
  }
}
