import { z } from "zod";
import { describe, expect, it } from "vitest";

import { searchPagesInputSchema } from "../src/schemas/search-pages.js";

const schema = z.object(searchPagesInputSchema);

describe("searchPagesInputSchema", () => {
  it("aceita uma consulta válida e aplica o limite padrão", () => {
    expect(schema.parse({ query: "admissão" })).toEqual({ query: "admissão", limit: 10 });
  });

  it("rejeita consulta vazia", () => {
    expect(schema.safeParse({ query: "   " }).success).toBe(false);
  });

  it("rejeita consulta muito longa", () => {
    expect(schema.safeParse({ query: "a".repeat(201) }).success).toBe(false);
  });

  it("rejeita limite acima do teto absoluto", () => {
    expect(schema.safeParse({ query: "admissão", limit: 101 }).success).toBe(false);
  });
});
