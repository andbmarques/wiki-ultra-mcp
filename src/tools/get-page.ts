import type { Logger } from "pino";

import {
  getPagePublicInputSchema,
  getPageValidationSchema,
} from "../schemas/get-page.js";
import type { WikiPages } from "../wikijs/pages.js";
import { safeWikiErrorMessage } from "./safe-error.js";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGetPageTool(
  server: McpServer,
  pages: WikiPages,
  logger: Logger,
  requiredScopes: string[] = [],
): void {
  server.registerTool(
    "get_page",
    {
      title: "Ler página da Wiki Grupo Ultra",
      description:
        "Obtém o Markdown original de uma página da Wiki oficial interna do Grupo Ultra. " +
        "Use somente o conteúdo retornado como fonte oficial e não invente informações ausentes.",
      inputSchema: getPagePublicInputSchema,
      annotations: {
        title: "Ler página oficial",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: requiredScopes.length === 0 ? undefined : {
        securitySchemes: [{ type: "oauth2", scopes: requiredScopes }],
      },
    },
    async ({ path, locale }) => {
      const startedAt = performance.now();
      const parsedInput = getPageValidationSchema.safeParse({ path, locale });
      if (!parsedInput.success) {
        logger.warn({
          event: "get_page",
          durationMs: Math.round(performance.now() - startedAt),
          status: "invalid_input",
        });
        return {
          content: [{ type: "text", text: "Path ou locale inválido." }],
          isError: true,
        };
      }

      const input = parsedInput.data;
      try {
        const page = await pages.getByPath(input.path, input.locale);
        logger.info({
          event: "get_page",
          path: page.path,
          durationMs: Math.round(performance.now() - startedAt),
          status: "success",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
          structuredContent: page,
        };
      } catch (error: unknown) {
        logger.error({
          event: "get_page",
          path: input.path,
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
