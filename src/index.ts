import "dotenv/config";

import { loadConfig } from "./config/env.js";
import { createHttpApp } from "./http/app.js";
import { createLogger } from "./logging/logger.js";
import { WikiClient } from "./wikijs/client.js";
import { WikiPages } from "./wikijs/pages.js";
import { WikiSearch } from "./wikijs/search.js";

const config = loadConfig();
const logger = createLogger(config);

if (config.MCP_API_KEY === undefined) {
  logger.warn({ event: "startup", message: "Endpoint /mcp sem autenticação em ambiente não produtivo." });
}

const wikiClient = new WikiClient({
  baseUrl: config.WIKI_URL,
  apiToken: config.WIKI_API_TOKEN,
  timeoutMs: config.WIKI_TIMEOUT_MS,
  maxResponseBytes: config.MAX_PAGE_CONTENT_BYTES + 100_000,
});
const pages = new WikiPages(wikiClient, config.WIKI_LOCALE, config.MAX_PAGE_CONTENT_BYTES);
const wikiSearch = new WikiSearch(wikiClient, config.WIKI_LOCALE, config.SEARCH_MAX_RESULTS);
const app = createHttpApp(config, pages, wikiSearch, logger);

const httpServer = app.listen(config.PORT, "0.0.0.0", () => {
  logger.info({
    event: "startup",
    status: "ready",
    port: config.PORT,
    mcpPath: "/mcp",
  });
});

function shutdown(signal: string): void {
  logger.info({ event: "shutdown", signal });
  httpServer.close((error) => {
    if (error) {
      logger.error({ event: "shutdown", errorMessage: error.message });
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
