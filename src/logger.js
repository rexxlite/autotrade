const levels = ["debug", "info", "warn", "error"];

function shouldLog(configuredLevel, requestedLevel) {
  return levels.indexOf(requestedLevel) >= levels.indexOf(configuredLevel);
}

function format(scope, level, message, extra) {
  const timestamp = new Date().toISOString();
  const serialized = extra ? ` ${JSON.stringify(extra)}` : "";
  return `[${timestamp}] [${scope}] [${level.toUpperCase()}] ${message}${serialized}`;
}

export function createLogger(scope, level = "info") {
  return {
    debug(message, extra) {
      if (shouldLog(level, "debug")) {
        console.debug(format(scope, "debug", message, extra));
      }
    },
    info(message, extra) {
      if (shouldLog(level, "info")) {
        console.info(format(scope, "info", message, extra));
      }
    },
    warn(message, extra) {
      if (shouldLog(level, "warn")) {
        console.warn(format(scope, "warn", message, extra));
      }
    },
    error(message, extra) {
      if (shouldLog(level, "error")) {
        console.error(format(scope, "error", message, extra));
      }
    }
  };
}
