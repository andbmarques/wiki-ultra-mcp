import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "pino";

import {
  searchPagesPublicInputSchema,
  searchPagesValidationSchema,
} from "../schemas/search-pages.js";
import type { WikiSearch } from "../wikijs/search.js";
import { safeWikiErrorMessage } from "./safe-error.js";

export function registerSearchPagesTool(
  server: McpServer,
  wikiSearch: WikiSearch,
  logger: Logger,
  requiredScopes: string[] = [],
): void {
  server.registerTool(
    "search_pages",
    {
      title: "Pesquisar na Wiki Grupo Ultra",
      description:
        "Pesquisa páginas da Wiki oficial interna do Grupo Ultra por texto livre. " +
        "Os resultados apontam para a fonte oficial; não invente conteúdo que não esteja na Wiki.",
      inputSchema: searchPagesPublicInputSchema,
      annotations: {
        title: "Pesquisar páginas oficiais",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: requiredScopes.length === 0 ? undefined : {
        securitySchemes: [{ type: "oauth2", scopes: requiredScopes }],
      },
    },
    async ({ query, limit, locale }) => {
      const startedAt = performance.now();
      const parsedInput = searchPagesValidationSchema.safeParse({ query, limit, locale });
      if (!parsedInput.success) {
        logger.warn({
          event: "search_pages",
          durationMs: Math.round(performance.now() - startedAt),
          status: "invalid_input",
        });
        return {
          content: [{ type: "text", text: "Parâmetros de busca inválidos." }],
          isError: true,
        };
      }

      const input = parsedInput.data;
      try {
        const response = await wikiSearch.searchPages(input.query, input.limit, input.locale);
        logger.info({
          event: "search_pages",
          queryLength: input.query.length,
          resultCount: response.returnedCount,
          totalHits: response.totalHits,
          durationMs: Math.round(performance.now() - startedAt),
          status: "success",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
          structuredContent: response,
        };
      } catch (error: unknown) {
        logger.error({
          event: "search_pages",
          queryLength: input.query.length,
          durationMs: Math.round(performance.now() - startedAt),
          status: "error",
          errorType: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
        });
        return {
          content: [{ type: "text", text: safeWikiErrorMessage(error) }],
          isError: true,
        };
      }
    },
  );
}
