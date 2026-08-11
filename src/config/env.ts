import { z } from "zod";

const integerFromEnvironment = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);

const optionalString = (schema: z.ZodType<string>) =>
  z.preprocess((value) => value === "" ? undefined : value, schema.optional());

const allowedJwtAlgorithms = new Set([
  "RS256", "RS384", "RS512", "PS256", "PS384", "PS512",
  "ES256", "ES384", "ES512", "EdDSA",
]);

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
    MCP_AUTH_MODE: z.enum(["api-key", "oauth"]).default("api-key"),
    MCP_API_KEY: optionalString(z.string().min(16)),
    MCP_BASE_URL: z.url().default("http://localhost:3001"),
    OAUTH_ISSUER_URL: optionalString(z.url()),
    OAUTH_JWKS_URL: optionalString(z.url()),
    OAUTH_RESOURCE_URL: optionalString(z.url()),
    OAUTH_AUDIENCE: optionalString(z.string().min(1)),
    OAUTH_REQUIRED_SCOPES: z.string().min(1).default("wiki.read"),
    OAUTH_ALLOWED_ALGORITHMS: z.string().min(1).default("RS256"),
    OAUTH_CLOCK_TOLERANCE_SECONDS: integerFromEnvironment(0, 60).default(5),
    OAUTH_RESOURCE_DOCUMENTATION_URL: optionalString(z.url()),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === "production" && environment.MCP_AUTH_MODE !== "oauth") {
      context.addIssue({
        code: "custom",
        path: ["MCP_AUTH_MODE"],
        message: "MCP_AUTH_MODE deve ser oauth em produção",
      });
    }

    if (environment.MCP_AUTH_MODE === "api-key" && environment.MCP_API_KEY === undefined) {
      context.addIssue({
        code: "custom",
        path: ["MCP_API_KEY"],
        message: "MCP_API_KEY é obrigatório no modo api-key",
      });
    }

    if (environment.MCP_AUTH_MODE === "oauth") {
      for (const field of ["OAUTH_ISSUER_URL", "OAUTH_JWKS_URL", "OAUTH_RESOURCE_URL"] as const) {
        if (environment[field] === undefined) {
          context.addIssue({ code: "custom", path: [field], message: `${field} é obrigatório` });
        }
      }

      const algorithms = environment.OAUTH_ALLOWED_ALGORITHMS.split(/[\s,]+/u).filter(Boolean);
      if (algorithms.length === 0 || algorithms.some((algorithm) => !allowedJwtAlgorithms.has(algorithm))) {
        context.addIssue({
          code: "custom",
          path: ["OAUTH_ALLOWED_ALGORITHMS"],
          message: "OAUTH_ALLOWED_ALGORITHMS contém algoritmo não permitido",
        });
      }

      if (environment.NODE_ENV === "production") {
        for (const field of [
          "MCP_BASE_URL", "OAUTH_ISSUER_URL", "OAUTH_JWKS_URL", "OAUTH_RESOURCE_URL",
        ] as const) {
          if (environment[field] !== undefined && new URL(environment[field]).protocol !== "https:") {
            context.addIssue({ code: "custom", path: [field], message: `${field} deve usar HTTPS` });
          }
        }
      }

      if (environment.OAUTH_RESOURCE_URL !== undefined) {
        const expectedResource = new URL("/mcp", environment.MCP_BASE_URL).href;
        if (new URL(environment.OAUTH_RESOURCE_URL).href !== expectedResource) {
          context.addIssue({
            code: "custom",
            path: ["OAUTH_RESOURCE_URL"],
            message: "OAUTH_RESOURCE_URL deve identificar o endpoint público /mcp",
          });
        }
      }
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
