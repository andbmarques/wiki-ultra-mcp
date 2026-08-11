import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { JwtTokenVerifier } from "../src/security/oauth.js";

const issuer = "https://login.example.com";
const audience = "https://mcp.example.com/mcp";
let verifier: JwtTokenVerifier;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = "test-key";
  verifier = new JwtTokenVerifier({
    issuer,
    jwksUrl: "https://unused.example.com/jwks",
    audience,
    resourceUrl: audience,
    algorithms: ["RS256"],
    clockToleranceSeconds: 0,
    keyResolver: createLocalJWKSet({ keys: [publicJwk] }),
  });
});

async function token(overrides: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({ scope: "wiki.read profile", client_id: "chatgpt-client", ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("JwtTokenVerifier", () => {
  it("valida assinatura, emissor, audience, exp e scopes", async () => {
    const auth = await verifier.verifyAccessToken(await token());
    expect(auth.clientId).toBe("chatgpt-client");
    expect(auth.scopes).toEqual(["wiki.read", "profile"]);
    expect(auth.resource?.href).toBe(audience);
  });

  it("rejeita token para outro recurso", async () => {
    const invalid = await new SignJWT({ scope: "wiki.read", client_id: "client" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience("https://other.example.com")
      .setExpirationTime("5m")
      .sign(privateKey);
    await expect(verifier.verifyAccessToken(invalid)).rejects.toThrow("Access token inválido");
  });

  it("rejeita token sem exp", async () => {
    const invalid = await new SignJWT({ scope: "wiki.read", client_id: "client" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .sign(privateKey);
    await expect(verifier.verifyAccessToken(invalid)).rejects.toThrow("Access token inválido");
  });
});
