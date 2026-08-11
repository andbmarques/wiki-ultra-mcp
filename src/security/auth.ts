import { timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";
import type {} from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import {
  InsufficientScopeError,
  InvalidTokenError,
  OAuthError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
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
  authorizationScopes: string[];
}

interface OAuthBearerOptions {
  verifier: OAuthTokenVerifier;
  tokenScopes: string[];
  authorizationScopes: string[];
  resourceMetadataUrl: string;
}

function oauthChallenge(
  errorCode: string,
  message: string,
  authorizationScopes: string[],
  resourceMetadataUrl: string,
): string {
  return `Bearer error="${errorCode}", error_description="${message}", ` +
    `scope="${authorizationScopes.join(" ")}", resource_metadata="${resourceMetadataUrl}"`;
}

function requireOAuthBearer({
  verifier,
  tokenScopes,
  authorizationScopes,
  resourceMetadataUrl,
}: OAuthBearerOptions): RequestHandler {
  return async (request, response, next) => {
    try {
      const authorization = request.header("authorization");
      const match = /^Bearer\s+(.+)$/iu.exec(authorization ?? "");
      if (match?.[1] === undefined) throw new InvalidTokenError("Missing or invalid Authorization header");

      const auth = await verifier.verifyAccessToken(match[1]);
      if (!tokenScopes.every((scope) => auth.scopes.includes(scope))) {
        throw new InsufficientScopeError("Insufficient scope");
      }
      if (
        typeof auth.expiresAt !== "number" ||
        !Number.isFinite(auth.expiresAt) ||
        auth.expiresAt < Date.now() / 1000
      ) {
        throw new InvalidTokenError("Token has expired or has no expiration time");
      }

      request.auth = auth;
      next();
    } catch (error: unknown) {
      if (error instanceof InvalidTokenError || error instanceof InsufficientScopeError) {
        response.set("WWW-Authenticate", oauthChallenge(
          error.errorCode,
          error.message,
          authorizationScopes,
          resourceMetadataUrl,
        ));
        response.status(error instanceof InvalidTokenError ? 401 : 403).json(error.toResponseObject());
        return;
      }
      if (error instanceof ServerError) {
        response.status(500).json(error.toResponseObject());
        return;
      }
      if (error instanceof OAuthError) {
        response.status(400).json(error.toResponseObject());
        return;
      }
      const serverError = new ServerError("Internal Server Error");
      response.status(500).json(serverError.toResponseObject());
    }
  };
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
      authorizationScopes: [],
    };
  }

  const issuer = config.OAUTH_ISSUER_URL as string;
  const jwksUrl = config.OAUTH_JWKS_URL as string;
  const resourceUrl = config.OAUTH_RESOURCE_URL as string;
  const requiredScopes = parseSpaceSeparated(config.OAUTH_REQUIRED_SCOPES);
  const authorizationScopes = parseSpaceSeparated(config.OAUTH_AUTHORIZATION_SCOPES as string);
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
    authenticate: requireOAuthBearer({
      verifier,
      tokenScopes: requiredScopes,
      authorizationScopes,
      resourceMetadataUrl: metadataUrl,
    }),
    metadataPath: new URL(metadataUrl).pathname,
    authorizationScopes,
    metadata: {
      resource: resourceUrl,
      authorization_servers: [issuer],
      scopes_supported: authorizationScopes,
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
