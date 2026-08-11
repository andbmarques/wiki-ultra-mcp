import pino, { type Logger } from "pino";

import type { AppConfig } from "../config/env.js";

export function createLogger(config: Pick<AppConfig, "LOG_LEVEL">): Logger {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: "ultra-wiki-mcp" },
    redact: {
      paths: [
        "authorization",
        "headers.authorization",
        "req.headers.authorization",
        "WIKI_API_TOKEN",
        "MCP_API_KEY",
        "token",
      ],
      censor: "[REDACTED]",
    },
  });
}
