import { describe, expect, it, vi } from "vitest";

import type { WikiClient } from "../src/wikijs/client.js";
import { WikiUnexpectedResponseError } from "../src/wikijs/errors.js";
import { WikiSearch } from "../src/wikijs/search.js";

const searchResults = [
  {
    id: "10",
    title: "Procedimento de Admissão",
    description: "Admissão de colaboradores",
    path: "departamento-pessoal/admissao",
    locale: "pt-br",
  },
  {
    id: "20",
    title: "Checklist de Admissão",
    description: "Itens necessários",
    path: "/departamento-pessoal/checklist-admissao",
    locale: "pt-br",
  },
  {
    id: "30",
    title: "Arquivo antigo",
    description: "Resultado menos relevante",
    path: "arquivo/admissao",
    locale: "pt-br",
  },
];

describe("WikiSearch", () => {
  it("preserva a relevância da Wiki, normaliza paths e aplica o teto do servidor", async () => {
    const query = vi.fn().mockResolvedValue({
      pages: {
        search: { results: searchResults, suggestions: ["admissão"], totalHits: 3 },
      },
    });
    const search = new WikiSearch({ query } as unknown as WikiClient, "pt-br", 2);

    const response = await search.searchPages("admissao", 10);

    expect(response.results).toHaveLength(2);
    expect(response.results.map((result) => result.pageId)).toEqual(["10", "20"]);
    expect(response.results.map((result) => result.path)).toEqual([
      "/departamento-pessoal/admissao",
      "/departamento-pessoal/checklist-admissao",
    ]);
    expect(response).toMatchObject({
      totalHits: 3,
      returnedCount: 2,
      suggestions: ["admissão"],
      source: "Wiki Oficial do Grupo Ultra",
    });
    expect(query).toHaveBeenCalledWith(expect.any(String), {
      query: "admissao",
      locale: "pt-br",
    });
  });

  it("retorna uma lista vazia quando não há resultados", async () => {
    const query = vi.fn().mockResolvedValue({
      pages: { search: { results: [], suggestions: [], totalHits: 0 } },
    });
    const search = new WikiSearch({ query } as unknown as WikiClient, "pt-br", 20);

    await expect(search.searchPages("inexistente", 10)).resolves.toMatchObject({
      results: [],
      totalHits: 0,
      returnedCount: 0,
    });
  });

  it("rejeita uma resposta inesperada da Wiki", async () => {
    const query = vi.fn().mockResolvedValue({ pages: { search: { results: null } } });
    const search = new WikiSearch({ query } as unknown as WikiClient, "pt-br", 20);

    await expect(search.searchPages("admissão", 10)).rejects.toBeInstanceOf(
      WikiUnexpectedResponseError,
    );
  });
});
