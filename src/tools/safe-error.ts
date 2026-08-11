import {
  WikiAuthenticationError,
  WikiNotFoundError,
  WikiTimeoutError,
} from "../wikijs/errors.js";

export function safeWikiErrorMessage(error: unknown): string {
  if (error instanceof WikiNotFoundError) return "Página não encontrada.";
  if (error instanceof WikiTimeoutError) return "A consulta à Wiki excedeu o tempo limite.";
  if (error instanceof WikiAuthenticationError) return "Não foi possível autenticar na Wiki.";
  return "Não foi possível consultar a Wiki neste momento.";
}
