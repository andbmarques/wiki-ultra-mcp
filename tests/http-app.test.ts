import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";

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
});
