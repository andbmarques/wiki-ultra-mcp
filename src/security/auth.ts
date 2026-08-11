import { timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";

import type { AppConfig } from "../config/env.js";
import { JwtTokenVerifier, parseSpaceSeparated } from "./oauth.js";

function tokensMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export interface McpAuthentication {
  authenticate: RequestHandler;
  metadataPath: string;
  metadata: Record<string, unknown>;
  requiredScopes: string[];
}

export function createMcpAuthentication(
  config: AppConfig,
  verifierOverride?: OAuthTokenVerifier,
): McpAuthentication {
  if (config.MCP_AUTH_MODE === "api-key") {
    return {
      authenticate: requireMcpApiKey(config.MCP_API_KEY),
      metadataPath: "",
      metadata: {},
      requiredScopes: [],
    };
  }

  const issuer = config.OAUTH_ISSUER_URL as string;
  const jwksUrl = config.OAUTH_JWKS_URL as string;
  const resourceUrl = config.OAUTH_RESOURCE_URL as string;
  const requiredScopes = parseSpaceSeparated(config.OAUTH_REQUIRED_SCOPES);
  const verifier = verifierOverride ?? new JwtTokenVerifier({
    issuer,
    jwksUrl,
    audience: config.OAUTH_AUDIENCE ?? resourceUrl,
    resourceUrl,
    algorithms: parseSpaceSeparated(config.OAUTH_ALLOWED_ALGORITHMS),
    clockToleranceSeconds: config.OAUTH_CLOCK_TOLERANCE_SECONDS,
  });
  const metadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(resourceUrl));

  return {
    authenticate: requireBearerAuth({
      verifier,
      requiredScopes,
      resourceMetadataUrl: metadataUrl,
    }),
    metadataPath: new URL(metadataUrl).pathname,
    requiredScopes,
    metadata: {
      resource: resourceUrl,
      authorization_servers: [issuer],
      scopes_supported: requiredScopes,
      bearer_methods_supported: ["header"],
      resource_name: "Wiki Oficial do Grupo Ultra",
      ...(config.OAUTH_RESOURCE_DOCUMENTATION_URL === undefined
        ? {}
        : { resource_documentation: config.OAUTH_RESOURCE_DOCUMENTATION_URL }),
    },
  };
}

export function requireMcpApiKey(expectedApiKey: string | undefined): RequestHandler {
  return (request, response, next) => {
    if (expectedApiKey === undefined) {
      next();
      return;
    }

    const authorization = request.header("authorization");
    const prefix = "Bearer ";
    const token = authorization?.startsWith(prefix) ? authorization.slice(prefix.length) : "";

    if (!tokensMatch(token, expectedApiKey)) {
      response.status(401).json({ error: "Não autorizado." });
      return;
    }

    next();
  };
}
