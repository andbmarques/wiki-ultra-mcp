import { z } from "zod";

import {
  WikiAuthenticationError,
  WikiTimeoutError,
  WikiUnexpectedResponseError,
} from "./errors.js";

const graphQlEnvelopeSchema = z.object({
  data: z.unknown().optional(),
  errors: z
    .array(
      z.object({
        message: z.string().catch("Erro GraphQL não identificado"),
      }),
    )
    .optional(),
});

export interface WikiClientOptions {
  baseUrl: string;
  apiToken: string;
  timeoutMs: number;
  maxResponseBytes: number;
  fetchImplementation?: typeof fetch;
}

export class WikiClient {
  readonly #endpoint: URL;
  readonly #apiToken: string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #fetch: typeof fetch;

  public constructor(options: WikiClientOptions) {
    this.#endpoint = new URL("/graphql", options.baseUrl);
    this.#apiToken = options.apiToken;
    this.#timeoutMs = options.timeoutMs;
    this.#maxResponseBytes = options.maxResponseBytes;
    this.#fetch = options.fetchImplementation ?? fetch;
  }

  public async query<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
    let response: Response;

    try {
      response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.#apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error: unknown) {
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw new WikiTimeoutError("A consulta à Wiki excedeu o tempo limite.", { cause: error });
      }
      throw new WikiUnexpectedResponseError("Não foi possível conectar à Wiki.", { cause: error });
    }

    if (response.status === 401 || response.status === 403) {
      throw new WikiAuthenticationError("A Wiki recusou a credencial de leitura.");
    }
    if (!response.ok) {
      throw new WikiUnexpectedResponseError(`A Wiki respondeu com HTTP ${response.status}.`);
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > this.#maxResponseBytes) {
      throw new WikiUnexpectedResponseError("A resposta da Wiki excedeu o tamanho permitido.");
    }

    const rawBody = await response.arrayBuffer();
    if (rawBody.byteLength > this.#maxResponseBytes) {
      throw new WikiUnexpectedResponseError("A resposta da Wiki excedeu o tamanho permitido.");
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(new TextDecoder().decode(rawBody));
    } catch (error: unknown) {
      throw new WikiUnexpectedResponseError("A Wiki retornou JSON inválido.", { cause: error });
    }

    const envelope = graphQlEnvelopeSchema.safeParse(decoded);
    if (!envelope.success) {
      throw new WikiUnexpectedResponseError("A Wiki retornou uma resposta GraphQL inesperada.");
    }

    if (envelope.data.errors?.length) {
      const messages = envelope.data.errors.map((item) => item.message);
      if (messages.some((message) => /forbidden|unauthenticated|unauthorized/i.test(message))) {
        throw new WikiAuthenticationError("A Wiki recusou a credencial de leitura.");
      }
      throw new WikiUnexpectedResponseError(`Erro GraphQL: ${messages.join("; ")}`);
    }
    if (envelope.data.data === undefined) {
      throw new WikiUnexpectedResponseError("A resposta GraphQL não contém dados.");
    }

    return envelope.data.data as TData;
  }
}
