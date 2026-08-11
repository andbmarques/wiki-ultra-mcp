import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server } from "node:http";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";

import { createHttpApp } from "../src/http/app.js";
import type { WikiPages } from "../src/wikijs/pages.js";
import type { WikiSearch } from "../src/wikijs/search.js";
import { testConfig } from "./helpers.js";

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

describe("MCP via Streamable HTTP", () => {
  it("negocia o protocolo, lista as tools e executa search_pages", async () => {
    const searchPages = vi.fn().mockResolvedValue({
      results: [],
      totalHits: 0,
      returnedCount: 0,
      suggestions: [],
      source: "Wiki Oficial do Grupo Ultra",
    });
    const app = createHttpApp(
      testConfig({ MCP_BASE_URL: "http://127.0.0.1:3001" }),
      {} as WikiPages,
      { searchPages } as unknown as WikiSearch,
      pino({ level: "silent" }),
    );
    const httpServer = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const address = httpServer.address();
    if (address === null || typeof address === "string") throw new Error("Porta HTTP indisponível");

    const client = new Client({ name: "http-test-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${address.port}/mcp`),
      { requestInit: { headers: { authorization: "Bearer mcp-test-token-123" } } },
    );

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(["get_page", "search_pages"]),
      );

      const result = await client.callTool({
        name: "search_pages",
        arguments: { query: "admissão" },
      });
      expect(result.structuredContent).toMatchObject({ totalHits: 0, returnedCount: 0 });
      expect(searchPages).toHaveBeenCalledWith("admissão", 10, undefined);
    } finally {
      await client.close();
      await closeServer(httpServer);
    }
  });
});
