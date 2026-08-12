import { describe, expect, it } from "vitest";

import { getPageValidationSchema } from "../src/schemas/get-page.js";

describe("getPageValidationSchema", () => {
  it("aceita um path válido com caracteres Unicode", () => {
    expect(
      getPageValidationSchema.parse({ path: "/departamento-pessoal/admissão" }),
    ).toEqual({ path: "/departamento-pessoal/admissão" });
  });

  it("rejeita path acima do tamanho máximo", () => {
    expect(getPageValidationSchema.safeParse({ path: `/${"a".repeat(500)}` }).success).toBe(
      false,
    );
  });

  it("rejeita caracteres não permitidos", () => {
    expect(getPageValidationSchema.safeParse({ path: "/procedimento?<script>" }).success).toBe(
      false,
    );
  });

  it("rejeita segmentos de travessia", () => {
    expect(getPageValidationSchema.safeParse({ path: "/comercial/../financeiro" }).success).toBe(
      false,
    );
  });
});
