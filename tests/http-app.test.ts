import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";

import { createHttpApp } from "../src/http/app.js";
import type { WikiPages } from "../src/wikijs/pages.js";
import type { WikiSearch } from "../src/wikijs/search.js";
import { testConfig } from "./helpers.js";

const unusedPages = {} as WikiPages;
const unusedSearch = {} as WikiSearch;
const silentLogger = pino({ level: "silent" });

describe("HTTP app", () => {
  it("expõe healthcheck sem dados sensíveis", async () => {
    const response = await request(
      createHttpApp(testConfig(), unusedPages, unusedSearch, silentLogger),
    ).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("protege o endpoint MCP com Bearer", async () => {
    const app = createHttpApp(testConfig(), unusedPages, unusedSearch, silentLogger);
    const unauthorized = await request(app).post("/mcp").send({});
    const authorized = await request(app)
      .get("/mcp")
      .set("authorization", "Bearer mcp-test-token-123");

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(405);
  });

  it("publica metadata e challenge OAuth 2.1", async () => {
    const verifier: OAuthTokenVerifier = {
      verifyAccessToken: (token) => Promise.resolve({
        token,
        clientId: "chatgpt-client",
        scopes: token === "valid-token" ? ["wiki.read"] : [],
        expiresAt: Math.floor(Date.now() / 1000) + 300,
        resource: new URL("https://mcp.example.com/mcp"),
      }),
    };
    const config = testConfig({
      MCP_AUTH_MODE: "oauth",
      MCP_API_KEY: undefined,
      MCP_BASE_URL: "https://mcp.example.com",
      OAUTH_ISSUER_URL: "https://login.example.com",
      OAUTH_JWKS_URL: "https://login.example.com/jwks",
      OAUTH_RESOURCE_URL: "https://mcp.example.com/mcp",
    });
    const app = createHttpApp(config, unusedPages, unusedSearch, silentLogger, verifier);

    const metadata = await request(app).get("/.well-known/oauth-protected-resource/mcp");
    const unauthorized = await request(app).get("/mcp");
    const insufficient = await request(app).get("/mcp").set("authorization", "Bearer no-scope");
    const authorized = await request(app).get("/mcp").set("authorization", "Bearer valid-token");

    expect(metadata.status).toBe(200);
    expect(metadata.body).toMatchObject({
      resource: "https://mcp.example.com/mcp",
      authorization_servers: ["https://login.example.com"],
      scopes_supported: ["wiki.read"],
    });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.header["www-authenticate"]).toContain("resource_metadata=");
    expect(insufficient.status).toBe(403);
    expect(authorized.status).toBe(405);
  });
});
