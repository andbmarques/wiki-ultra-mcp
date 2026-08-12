import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";

import { createWikiMcpServer } from "../src/mcp/server.js";
import type { WikiPages } from "../src/wikijs/pages.js";
import type { WikiSearch } from "../src/wikijs/search.js";

describe("MCP server", () => {
  it("publica schemas de input simples e compatíveis em tools/list", async () => {
    const server = createWikiMcpServer(
      {} as WikiPages,
      {} as WikiSearch,
      pino({ level: "silent" }),
    );
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const { tools } = await client.listTools();
      const getPage = tools.find((tool) => tool.name === "get_page");
      const searchPages = tools.find((tool) => tool.name === "search_pages");

      expect(getPage?.inputSchema).toMatchObject({
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Caminho da página na Wiki oficial, por exemplo /procedimento-admissao",
          },
          locale: {
            type: "string",
            description: "Locale da página; por padrão, pt-br",
          },
        },
        required: ["path"],
      });
      expect(searchPages?.inputSchema).toMatchObject({
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
          locale: { type: "string" },
        },
        required: ["query"],
      });

      for (const tool of [getPage, searchPages]) {
        const publicSchema = JSON.stringify(tool?.inputSchema);
        expect(publicSchema).not.toContain("pattern");
        expect(publicSchema).not.toContain("minLength");
        expect(publicSchema).not.toContain("maxLength");
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("descobre e executa get_page com resposta estruturada", async () => {
    const getByPath = vi.fn().mockResolvedValue({
      pageId: 7,
      title: "Página de teste",
      path: "/pagina-teste",
      description: "Documento oficial",
      content: "# Página de teste",
      contentType: "markdown",
      source: "Wiki Oficial do Grupo Ultra",
      locale: "pt-br",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      updatedBy: "Equipe Ultra",
    });
    const pages = { getByPath } as unknown as WikiPages;
    const wikiSearch = {} as WikiSearch;
    const server = createWikiMcpServer(pages, wikiSearch, pino({ level: "silent" }));
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("get_page");

      const result = await client.callTool({
        name: "get_page",
        arguments: { path: "/pagina-teste" },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        path: "/pagina-teste",
        contentType: "markdown",
        source: "Wiki Oficial do Grupo Ultra",
      });
      expect(getByPath).toHaveBeenCalledWith("/pagina-teste", undefined);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("descobre e executa search_pages com resposta estruturada", async () => {
    const searchPages = vi.fn().mockResolvedValue({
      results: [
        {
          pageId: "7",
          title: "Página de teste",
          path: "/pagina-teste",
          description: "Documento oficial",
          locale: "pt-br",
          source: "Wiki Oficial do Grupo Ultra",
        },
      ],
      totalHits: 1,
      returnedCount: 1,
      suggestions: [],
      source: "Wiki Oficial do Grupo Ultra",
    });
    const pages = {} as WikiPages;
    const wikiSearch = { searchPages } as unknown as WikiSearch;
    const server = createWikiMcpServer(pages, wikiSearch, pino({ level: "silent" }));
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(["get_page", "search_pages"]),
      );

      const result = await client.callTool({
        name: "search_pages",
        arguments: { query: "admissão", limit: 5 },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ totalHits: 1, returnedCount: 1 });
      expect(searchPages).toHaveBeenCalledWith("admissão", 5, undefined);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
