import { describe, expect, it, vi } from "vitest";

import type { WikiClient } from "../src/wikijs/client.js";
import { WikiNotFoundError } from "../src/wikijs/errors.js";
import { WikiPages } from "../src/wikijs/pages.js";

const wikiPage = {
  id: 123,
  title: "Procedimento de Admissão",
  path: "departamento-pessoal/admissao",
  description: "Procedimento oficial",
  content: "# Procedimento\n\nConteúdo oficial.",
  contentType: "markdown",
  locale: "pt-br",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  authorName: "Equipe DP",
};

describe("WikiPages", () => {
  it("retorna Markdown e metadados rastreáveis", async () => {
    const query = vi.fn().mockResolvedValue({ pages: { singleByPath: wikiPage } });
    const pages = new WikiPages({ query } as unknown as WikiClient, "pt-br", 10_000);

    const result = await pages.getByPath("/departamento-pessoal/admissao");

    expect(result).toMatchObject({
      pageId: 123,
      path: "/departamento-pessoal/admissao",
      content: wikiPage.content,
      contentType: "markdown",
      source: "Wiki Oficial do Grupo Ultra",
    });
    expect(query).toHaveBeenCalledWith(expect.any(String), {
      path: "departamento-pessoal/admissao",
      locale: "pt-br",
    });
  });

  it("converte página nula em não encontrada", async () => {
    const query = vi.fn().mockResolvedValue({ pages: { singleByPath: null } });
    const pages = new WikiPages({ query } as unknown as WikiClient, "pt-br", 10_000);

    await expect(pages.getByPath("/inexistente")).rejects.toBeInstanceOf(WikiNotFoundError);
  });
});
