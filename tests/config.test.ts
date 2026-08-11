import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/env.js";

describe("loadConfig", () => {
  it("exige o token da Wiki", () => {
    expect(() => loadConfig({})).toThrow("WIKI_API_TOKEN");
  });

  it("exige autenticação MCP em produção", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        WIKI_API_TOKEN: "wiki-token",
      }),
    ).toThrow("MCP_API_KEY");
  });

  it("rejeita teto de busca inseguro", () => {
    expect(() =>
      loadConfig({
        WIKI_API_TOKEN: "wiki-token",
        SEARCH_MAX_RESULTS: "101",
      }),
    ).toThrow("SEARCH_MAX_RESULTS");
  });
});
