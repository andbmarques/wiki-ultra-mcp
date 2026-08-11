import { timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";

function tokensMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
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
