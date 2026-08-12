import { z } from "zod";

export const getPagePublicInputSchema = {
  path: z
    .string()
    .describe("Caminho da página na Wiki oficial, por exemplo /procedimento-admissao"),
  locale: z.string().optional().describe("Locale da página; por padrão, pt-br"),
};

export const getPageInputSchema = {
  path: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .regex(/^\/?[\p{L}\p{N}._~!$&'()*+,;=:@%/-]+$/u, "Path inválido")
    .refine((path) => !path.split("/").includes(".."), "Path inválido")
    .describe("Caminho da página na Wiki oficial, por exemplo /procedimento-admissao"),
  locale: z
    .string()
    .regex(/^[a-z]{2}(?:-[a-z]{2})?$/i)
    .optional()
    .describe("Locale da página; por padrão, pt-br"),
};

export const getPageValidationSchema = z.object(getPageInputSchema);
