import { z } from "zod";

import type { WikiClient } from "./client.js";
import { WikiUnexpectedResponseError } from "./errors.js";

export const SEARCH_PAGES_QUERY = `
  query SearchPages($query: String!, $locale: String!) {
    pages {
      search(query: $query, locale: $locale) {
        results {
          id
          title
          description
          path
          locale
        }
        suggestions
        totalHits
      }
    }
  }
`;

const searchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  path: z.string(),
  locale: z.string(),
});

const searchResponseSchema = z.object({
  pages: z.object({
    search: z.object({
      results: z.array(searchResultSchema),
      suggestions: z.array(z.string()),
      totalHits: z.number().int().nonnegative(),
    }),
  }),
});

export interface OfficialWikiSearchResult {
  [key: string]: unknown;
  pageId: string;
  title: string;
  path: string;
  description: string;
  locale: string;
  source: "Wiki Oficial do Grupo Ultra";
}

export interface OfficialWikiSearchResponse {
  [key: string]: unknown;
  results: OfficialWikiSearchResult[];
  totalHits: number;
  returnedCount: number;
  suggestions: string[];
  source: "Wiki Oficial do Grupo Ultra";
}

export class WikiSearch {
  public constructor(
    private readonly client: WikiClient,
    private readonly defaultLocale: string,
    private readonly maxResults: number,
  ) {}

  public async searchPages(
    query: string,
    requestedLimit: number,
    locale = this.defaultLocale,
  ): Promise<OfficialWikiSearchResponse> {
    const response = await this.client.query<unknown>(SEARCH_PAGES_QUERY, { query, locale });
    const parsed = searchResponseSchema.safeParse(response);

    if (!parsed.success) {
      throw new WikiUnexpectedResponseError("A Wiki retornou resultados de busca inesperados.");
    }

    const safeLimit = Math.min(requestedLimit, this.maxResults);
    const results = parsed.data.pages.search.results.slice(0, safeLimit).map((result) => ({
      pageId: result.id,
      title: result.title,
      path: `/${result.path.replace(/^\/+/, "")}`,
      description: result.description,
      locale: result.locale,
      source: "Wiki Oficial do Grupo Ultra" as const,
    }));

    return {
      results,
      totalHits: parsed.data.pages.search.totalHits,
      returnedCount: results.length,
      suggestions: parsed.data.pages.search.suggestions,
      source: "Wiki Oficial do Grupo Ultra",
    };
  }
}
