import { z } from "zod";

import type { WikiClient } from "./client.js";
import { WikiNotFoundError, WikiUnexpectedResponseError } from "./errors.js";

export const GET_PAGE_BY_PATH_QUERY = `
  query GetPageByPath($path: String!, $locale: String!) {
    pages {
      singleByPath(path: $path, locale: $locale) {
        id
        title
        path
        description
        content
        contentType
        locale
        createdAt
        updatedAt
        authorName
      }
    }
  }
`;

const wikiPageSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  path: z.string(),
  description: z.string(),
  content: z.string(),
  contentType: z.string(),
  locale: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  authorName: z.string(),
});

const getPageResponseSchema = z.object({
  pages: z.object({
    singleByPath: wikiPageSchema.nullable(),
  }),
});

export interface OfficialWikiPage {
  [key: string]: unknown;
  pageId: number;
  title: string;
  path: string;
  description: string;
  content: string;
  contentType: string;
  source: "Wiki Oficial do Grupo Ultra";
  locale: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export class WikiPages {
  public constructor(
    private readonly client: WikiClient,
    private readonly defaultLocale: string,
    private readonly maxContentBytes: number,
  ) {}

  public async getByPath(path: string, locale = this.defaultLocale): Promise<OfficialWikiPage> {
    const normalizedPath = path.replace(/^\/+|\/+$/g, "");
    const response = await this.client.query<unknown>(GET_PAGE_BY_PATH_QUERY, {
      path: normalizedPath,
      locale,
    });
    const parsed = getPageResponseSchema.safeParse(response);

    if (!parsed.success) {
      throw new WikiUnexpectedResponseError("A Wiki retornou campos de página inesperados.");
    }

    const page = parsed.data.pages.singleByPath;
    if (page === null) {
      throw new WikiNotFoundError("Página não encontrada.");
    }
    if (Buffer.byteLength(page.content, "utf8") > this.maxContentBytes) {
      throw new WikiUnexpectedResponseError("O conteúdo da página excedeu o tamanho permitido.");
    }

    return {
      pageId: page.id,
      title: page.title,
      path: `/${page.path.replace(/^\/+/, "")}`,
      description: page.description,
      content: page.content,
      contentType: page.contentType,
      source: "Wiki Oficial do Grupo Ultra",
      locale: page.locale,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      updatedBy: page.authorName,
    };
  }
}
