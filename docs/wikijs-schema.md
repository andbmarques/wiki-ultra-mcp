# Schema Wiki.js validado

Validação realizada em 11 de agosto de 2026 contra
`https://wiki.grupoultralinknet.com.br/graphql`.

## Resultado da descoberta

- O endpoint `/graphql` está disponível e responde a GraphQL.
- A instalação é Wiki.js 2.x, conforme informado pelo responsável e confirmado
  pelo formato do schema e pela aplicação em execução.
- A leitura anônima de `pages.list` retorna `Forbidden`.
- O build exato (`system.info.currentVersion`) exige autenticação e deverá ser
  registrado assim que a conta de serviço somente leitura estiver configurada.
- O método de autenticação adotado é `Authorization: Bearer <WIKI_API_TOKEN>`.
- O acesso é exclusivamente pela API; não há acesso direto ao PostgreSQL.

## Query necessária para o primeiro objetivo

O schema real expõe:

```graphql
pages.singleByPath(path: String!, locale: String!): Page
```

Os campos de `Page` usados pelo MCP foram confirmados por introspecção:

```text
id, title, path, description, content, contentType, locale,
createdAt, updatedAt, authorName
```

Query centralizada em `src/wikijs/pages.ts`:

```graphql
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
```

O campo `content` preserva o conteúdo-fonte. O MCP não usa `render`, portanto
não troca o Markdown original por HTML.

## Query de busca implementada

O schema confirmou:

```graphql
pages.search(query: String!, path: String, locale: String): PageSearchResponse!
```

`search_pages` consulta os campos `results`, `suggestions` e `totalHits`. Cada
resultado usa `id`, `title`, `description`, `path` e `locale`. Como essa query
não possui argumento `limit`, o MCP preserva a ordem retornada pelo mecanismo de
busca do Wiki.js e aplica localmente o teto `SEARCH_MAX_RESULTS`.

## Próxima query já identificada, ainda não implementada

```graphql
pages.list(limit: Int, ...): [PageListItem!]!
```

Ela será usada em `list_pages` para completar a v0.1.
