import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/env.js";

describe("loadConfig", () => {
  it("exige o token da Wiki", () => {
    expect(() => loadConfig({})).toThrow("WIKI_API_TOKEN");
  });

  it("exige OAuth em produção", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        WIKI_API_TOKEN: "wiki-token",
      }),
    ).toThrow("MCP_AUTH_MODE");
  });

  it("exige os endpoints OAuth no modo oauth", () => {
    expect(() =>
      loadConfig({
        WIKI_API_TOKEN: "wiki-token",
        MCP_AUTH_MODE: "oauth",
      }),
    ).toThrow("OAUTH_ISSUER_URL");
  });

  it("aceita configuração OAuth 2.1 completa em produção", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      WIKI_API_TOKEN: "wiki-token",
      MCP_AUTH_MODE: "oauth",
      MCP_BASE_URL: "https://mcp.example.com",
      OAUTH_ISSUER_URL: "https://login.example.com",
      OAUTH_JWKS_URL: "https://login.example.com/.well-known/jwks.json",
      OAUTH_RESOURCE_URL: "https://mcp.example.com/mcp",
    });

    expect(config.MCP_AUTH_MODE).toBe("oauth");
    expect(config.OAUTH_REQUIRED_SCOPES).toBe("wiki.read");
  });

  it("rejeita resource OAuth diferente do endpoint MCP público", () => {
    expect(() => loadConfig({
      WIKI_API_TOKEN: "wiki-token",
      MCP_AUTH_MODE: "oauth",
      MCP_BASE_URL: "https://mcp.example.com",
      OAUTH_ISSUER_URL: "https://login.example.com",
      OAUTH_JWKS_URL: "https://login.example.com/jwks",
      OAUTH_RESOURCE_URL: "https://mcp.example.com/outro",
    })).toThrow("OAUTH_RESOURCE_URL");
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
