import { z } from "zod";

export const searchPagesPublicInputSchema = {
  query: z.string().describe("Texto livre para pesquisar na Wiki oficial do Grupo Ultra"),
  limit: z
    .number()
    .optional()
    .describe("Quantidade desejada; o servidor aplica seu teto seguro configurado"),
  locale: z.string().optional().describe("Locale da busca; por padrão, pt-br"),
};

export const searchPagesInputSchema = {
  query: z
    .string()
    .trim()
    .min(1, "A consulta não pode estar vazia")
    .max(200, "A consulta excede o tamanho permitido")
    .describe("Texto livre para pesquisar na Wiki oficial do Grupo Ultra"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Quantidade desejada; o servidor aplica seu teto seguro configurado"),
  locale: z
    .string()
    .regex(/^[a-z]{2}(?:-[a-z]{2})?$/i)
    .optional()
    .describe("Locale da busca; por padrão, pt-br"),
};

export const searchPagesValidationSchema = z.object(searchPagesInputSchema);
