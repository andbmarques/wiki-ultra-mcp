import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Express, Request, Response } from "express";
import type { Logger } from "pino";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";

import type { AppConfig } from "../config/env.js";
import { createWikiMcpServer } from "../mcp/server.js";
import { createMcpAuthentication } from "../security/auth.js";
import type { WikiPages } from "../wikijs/pages.js";
import type { WikiSearch } from "../wikijs/search.js";

const methodNotAllowed = {
  jsonrpc: "2.0",
  error: { code: -32_000, message: "Method not allowed." },
  id: null,
};

export function createHttpApp(
  config: AppConfig,
  pages: WikiPages,
  wikiSearch: WikiSearch,
  logger: Logger,
  oauthVerifier?: OAuthTokenVerifier,
): Express {
  const publicHost = new URL(config.MCP_BASE_URL).hostname;
  const app = createMcpExpressApp({
    host: "0.0.0.0",
    allowedHosts: [publicHost, "localhost", "127.0.0.1"],
  });
  const authentication = createMcpAuthentication(config, oauthVerifier);
  const authenticate = authentication.authenticate;

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  if (config.MCP_AUTH_MODE === "oauth") {
    const sendMetadata = (_request: Request, response: Response) => response.json(authentication.metadata);
    app.get("/.well-known/oauth-protected-resource", sendMetadata);
    app.get(authentication.metadataPath, sendMetadata);
  }

  app.post("/mcp", authenticate, async (request: Request, response: Response) => {
    const server = createWikiMcpServer(pages, wikiSearch, logger, authentication.requiredScopes);
    const transport = new StreamableHTTPServerTransport({});

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error: unknown) {
      logger.error({
        event: "mcp_request",
        status: "error",
        errorType: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
      });
      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32_603, message: "Internal server error." },
          id: null,
        });
      }
    } finally {
      await transport.close();
      await server.close();
    }
  });

  app.get("/mcp", authenticate, (_request, response) => {
    response.status(405).json(methodNotAllowed);
  });
  app.delete("/mcp", authenticate, (_request, response) => {
    response.status(405).json(methodNotAllowed);
  });

  return app;
}
