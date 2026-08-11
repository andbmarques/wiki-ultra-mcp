import { z } from "zod";

const integerFromEnvironment = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: integerFromEnvironment(1, 65_535).default(3001),
    WIKI_URL: z.url().default("https://wiki.grupoultralinknet.com.br"),
    WIKI_API_TOKEN: z.string().min(1, "WIKI_API_TOKEN é obrigatório"),
    WIKI_LOCALE: z.string().regex(/^[a-z]{2}(?:-[a-z]{2})?$/i).default("pt-br"),
    WIKI_TIMEOUT_MS: integerFromEnvironment(100, 60_000).default(10_000),
    SEARCH_MAX_RESULTS: integerFromEnvironment(1, 100).default(20),
    MAX_PAGE_CONTENT_BYTES: integerFromEnvironment(1_024, 10_000_000).default(2_000_000),
    MCP_API_KEY: z.string().min(16).optional(),
    MCP_BASE_URL: z.url().default("http://localhost:3001"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === "production" && environment.MCP_API_KEY === undefined) {
      context.addIssue({
        code: "custom",
        path: ["MCP_API_KEY"],
        message: "MCP_API_KEY é obrigatório em produção",
      });
    }
  });

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Configuração inválida nos campos: ${fields}`);
  }

  return result.data;
}
