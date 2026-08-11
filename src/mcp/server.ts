import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";

import { registerGetPageTool } from "../tools/get-page.js";
import { registerSearchPagesTool } from "../tools/search-pages.js";
import type { WikiPages } from "../wikijs/pages.js";
import type { WikiSearch } from "../wikijs/search.js";

export function createWikiMcpServer(
  pages: WikiPages,
  wikiSearch: WikiSearch,
  logger: Logger,
): McpServer {
  const server = new McpServer({
    name: "ultra-wiki-mcp",
    version: "0.1.0",
    websiteUrl: "https://wiki.grupoultralinknet.com.br",
  });

  registerGetPageTool(server, pages, logger);
  registerSearchPagesTool(server, wikiSearch, logger);
  return server;
}
