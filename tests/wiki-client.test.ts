import { describe, expect, it, vi } from "vitest";

import { WikiClient } from "../src/wikijs/client.js";
import {
  WikiAuthenticationError,
  WikiTimeoutError,
  WikiUnexpectedResponseError,
} from "../src/wikijs/errors.js";

function clientWith(fetchImplementation: typeof fetch): WikiClient {
  return new WikiClient({
    baseUrl: "https://wiki.example.com",
    apiToken: "secret-service-token",
    timeoutMs: 100,
    maxResponseBytes: 10_000,
    fetchImplementation,
  });
}

describe("WikiClient", () => {
  it("autentica com Bearer e envia variáveis GraphQL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await clientWith(fetchMock).query<{ ok: boolean }>("query Test { ok }", { id: 1 });

    expect(result).toEqual({ ok: true });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-service-token");
    expect(init?.body).toBe(JSON.stringify({ query: "query Test { ok }", variables: { id: 1 } }));
  });

  it("converte Forbidden GraphQL em erro de autenticação", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "Forbidden" }], data: { pages: null } })),
    );

    await expect(clientWith(fetchMock).query("query Test { pages }", {})).rejects.toBeInstanceOf(
      WikiAuthenticationError,
    );
  });

  it("trata timeout sem expor detalhes", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("tempo excedido", "TimeoutError"));

    await expect(clientWith(fetchMock).query("query Test { ok }", {})).rejects.toBeInstanceOf(
      WikiTimeoutError,
    );
  });

  it("rejeita respostas acima do limite", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { content: "x".repeat(20_000) } })),
    );

    await expect(clientWith(fetchMock).query("query Test { content }", {})).rejects.toBeInstanceOf(
      WikiUnexpectedResponseError,
    );
  });
});
