# Ultra Wiki MCP

Remote MCP Server somente leitura para conectar o ChatGPT Workspace à Wiki
oficial do Grupo Ultra, hospedada em Wiki.js 2.x.

O servidor expõe `search_pages` para localizar documentação por texto livre e
`get_page` para devolver o Markdown original com metadados de origem. A Wiki
permanece a fonte da verdade; o MCP apenas fornece uma camada segura de acesso.

## Estado atual

- `POST /mcp`: transporte MCP Streamable HTTP, compatível com clientes MCP remotos.
- `search_pages`: busca por texto livre via GraphQL `pages.search`, com teto seguro.
- `get_page`: leitura por `path` e `locale` via GraphQL `pages.singleByPath`.
- `GET /health`: healthcheck sem consulta nem exposição de credenciais.
- Autenticação de saída para Wiki.js com token Bearer somente leitura.
- OAuth 2.1 Resource Server em produção, com descoberta RFC 9728, JWT/JWKS e escopo.
- Bearer estático (`MCP_API_KEY`) restrito ao desenvolvimento e MCP Inspector.
- Inputs validados, timeout e limites de payload.
- Logs estruturados sem token ou conteúdo integral da página.

`list_pages` permanece pendente para completar o escopo da v0.1.

## Pré-requisitos

- Node.js 22 ou superior, ou Docker.
- Token de API de uma conta de serviço do Wiki.js com permissão somente de leitura.
- Para produção, uma URL HTTPS pública para o endpoint MCP.

No Wiki.js, crie uma chave dedicada em **Administration > API Access**. Não use
uma credencial administrativa. Conceda apenas a permissão necessária para ler
as páginas que o ChatGPT deve consultar.

## Configuração local

```powershell
Copy-Item .env.example .env
```

Preencha no `.env`:

```env
WIKI_API_TOKEN=token-da-conta-de-servico
MCP_AUTH_MODE=api-key
MCP_API_KEY=uma-chave-longa-para-proteger-o-endpoint
```

Depois execute:

```powershell
npm install
npm run dev
```

O servidor inicia por padrão em `http://localhost:3001`:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

## Testar com MCP Inspector

Com o servidor ativo, conecte um cliente MCP Streamable HTTP a:

```text
http://localhost:3001/mcp
```

Envie o header:

```text
Authorization: Bearer <MCP_API_KEY>
```

Pesquise primeiro:

```json
{
  "query": "admissão",
  "limit": 10,
  "locale": "pt-br"
}
```

Use o `path` de um resultado para chamar `get_page`:

```json
{
  "path": "/caminho-da-pagina",
  "locale": "pt-br"
}
```

A resposta contém `title`, `path`, `content`, `contentType`, `source`, `pageId`,
`locale`, datas e autor da última atualização. Stack traces e credenciais nunca
são retornados pelo MCP.

## Docker

Defina `WIKI_API_TOKEN`, as variáveis OAuth e a URL pública em `MCP_BASE_URL`, então:

```powershell
docker compose up --build
```

A imagem usa Node LTS, build em múltiplos estágios e usuário não-root.

## Publicação para o ChatGPT Workspace

Publique o serviço atrás de HTTPS e configure como URL remota:

```text
https://seu-dominio.example.com/mcp
```

O transporte segue Streamable HTTP e o serviço atua como OAuth 2.1 Resource
Server. Ele publica Protected Resource Metadata, valida access tokens JWT pelo
JWKS do provedor corporativo e exige o escopo `wiki.read`. O provedor externo
(por exemplo, Entra ID, Auth0 ou Keycloak) continua responsável por login,
consentimento, Authorization Code + PKCE e emissão/renovação de tokens.

Produção exige `MCP_AUTH_MODE=oauth`, `OAUTH_ISSUER_URL`, `OAUTH_JWKS_URL`,
`OAUTH_RESOURCE_URL` e `OAUTH_AUTHORIZATION_SCOPES`. Para Microsoft Entra ID,
este último contém o scope totalmente qualificado solicitado pelo ChatGPT;
`OAUTH_REQUIRED_SCOPES` continua contendo o valor curto esperado no claim `scp`
do JWT. Veja a configuração completa em
[`docs/oauth.md`](docs/oauth.md) e o roteiro operacional em [`DEPLOY.md`](DEPLOY.md).

A documentação oficial da OpenAI descreve Remote MCP Servers por `server_url` e
alerta para limitar tools e revisar os dados compartilhados:
[MCP e Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp).

## Qualidade

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

O schema GraphQL efetivamente encontrado e as decisões da descoberta estão em
[`docs/wikijs-schema.md`](docs/wikijs-schema.md).

O procedimento completo para testar, publicar por HTTPS e cadastrar no ChatGPT
Workspace está em [`DEPLOY.md`](DEPLOY.md).

## Segurança

- Nunca commite `.env` ou tokens.
- Não registre cabeçalhos `Authorization` nem conteúdo integral das páginas.
- Não conceda escrita à conta de serviço desta versão.
- Não exponha o endpoint MCP sem autenticação em produção.
- Não reutilize `WIKI_API_TOKEN` como token OAuth nem envie esse segredo ao ChatGPT.
- Não acesse o PostgreSQL diretamente.
