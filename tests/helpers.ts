import type { AppConfig } from "../src/config/env.js";

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: "test",
    PORT: 3001,
    WIKI_URL: "https://wiki.example.com",
    WIKI_API_TOKEN: "wiki-test-token",
    WIKI_LOCALE: "pt-br",
    WIKI_TIMEOUT_MS: 1000,
    SEARCH_MAX_RESULTS: 20,
    MAX_PAGE_CONTENT_BYTES: 20_000,
    MCP_API_KEY: "mcp-test-token-123",
    MCP_BASE_URL: "http://localhost:3001",
    LOG_LEVEL: "silent",
    ...overrides,
  };
}
