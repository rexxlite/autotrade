function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeoutId };
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  return search.toString();
}

export class BybitClient {
  constructor({ baseUrl, timeoutMs, logger }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
    this.logger = logger;
  }

  async request(path, params = {}) {
    const query = buildQuery(params);
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ""}`;
    const { signal, timeoutId } = createTimeoutSignal(this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "user-agent": "paper-futures-bot/0.1.0"
        },
        signal
      });

      if (!response.ok) {
        throw new Error(`Bybit HTTP ${response.status} for ${path}`);
      }

      const payload = await response.json();
      if (payload.retCode !== 0) {
        throw new Error(`Bybit retCode ${payload.retCode}: ${payload.retMsg}`);
      }

      return payload.result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getTickers({ category, symbol } = {}) {
    const result = await this.request("/v5/market/tickers", { category, symbol });
    return result.list || [];
  }

  async getKlines({ category, symbol, interval, limit } = {}) {
    const result = await this.request("/v5/market/kline", { category, symbol, interval, limit });
    return result.list || [];
  }
}
