import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from "jose";

export interface JwtTokenVerifierOptions {
  issuer: string;
  jwksUrl: string;
  audience: string;
  resourceUrl: string;
  algorithms: string[];
  clockToleranceSeconds: number;
  keyResolver?: JWTVerifyGetKey;
}

function claimAsStrings(value: unknown): string[] {
  if (typeof value === "string") return value.split(/\s+/u).filter(Boolean);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function tokenClientId(payload: JWTPayload): string | undefined {
  for (const claim of [payload.client_id, payload.azp, payload.appid, payload.sub]) {
    if (typeof claim === "string" && claim.length > 0) return claim;
  }
  return undefined;
}

export class JwtTokenVerifier implements OAuthTokenVerifier {
  private readonly keyResolver: JWTVerifyGetKey;

  public constructor(private readonly options: JwtTokenVerifierOptions) {
    this.keyResolver = options.keyResolver ?? createRemoteJWKSet(new URL(options.jwksUrl));
  }

  public async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const { payload } = await jwtVerify(token, this.keyResolver, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: this.options.algorithms,
        clockTolerance: this.options.clockToleranceSeconds,
      });

      if (payload.exp === undefined) throw new Error("Token sem exp");
      const clientId = tokenClientId(payload);
      if (clientId === undefined) throw new Error("Token sem client_id");

      const scopes = [...new Set([...claimAsStrings(payload.scope), ...claimAsStrings(payload.scp)])];
      return {
        token,
        clientId,
        scopes,
        expiresAt: payload.exp,
        resource: new URL(this.options.resourceUrl),
        extra: { subject: payload.sub, issuer: payload.iss },
      };
    } catch {
      throw new InvalidTokenError("Access token inválido.");
    }
  }
}

export function parseSpaceSeparated(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/u).filter(Boolean))];
}
