# OAuth 2.1 do Ultra Wiki MCP

O `ultra-wiki-mcp` é o **Resource Server**. O login e a emissão de tokens ficam
em um Authorization Server/OIDC corporativo externo. Não existem usuários,
senhas, sessões ou endpoint de autorização dentro deste projeto.

## Fluxo

1. O ChatGPT acessa `/mcp` sem token e recebe HTTP 401 com
   `WWW-Authenticate` apontando para o Protected Resource Metadata.
2. O ChatGPT lê `/.well-known/oauth-protected-resource/mcp`, descobre o issuer e
   inicia Authorization Code com PKCE `S256` no provedor corporativo.
3. O provedor autentica o usuário e emite um access token JWT destinado a
   `OAUTH_RESOURCE_URL`/`OAUTH_AUDIENCE` com o escopo `wiki.read`.
4. O ChatGPT envia o JWT em `Authorization: Bearer ...`.
5. O MCP valida assinatura via JWKS, algoritmo, `iss`, `aud`, `exp` e escopos.
   Somente depois disso uma tool pode consultar a Wiki.

## Requisitos do Authorization Server

- discovery OAuth ou OpenID Connect no issuer configurado;
- Authorization Code e PKCE `S256`;
- endpoint de token;
- JWKS público por HTTPS;
- suporte ao parâmetro `resource` (RFC 8707) e audience do MCP;
- uma forma aceita pelo ChatGPT para registrar o cliente: CIMD, DCR ou cliente
  previamente cadastrado;
- refresh token/offline access conforme a política do Workspace;
- access token JWT assinado, com `exp`, identificação do cliente e escopo.

O MCP não aceita token opaco nesta versão. Se o provedor só emitir tokens
opacos, será necessário adicionar introspecção autenticada em uma evolução.

## Variáveis de produção

```env
NODE_ENV=production
MCP_AUTH_MODE=oauth
MCP_BASE_URL=https://mcp-wiki.grupoultra.com.br

OAUTH_ISSUER_URL=https://login.exemplo.com/tenant
OAUTH_JWKS_URL=https://login.exemplo.com/tenant/.well-known/jwks.json
OAUTH_RESOURCE_URL=https://mcp-wiki.grupoultra.com.br/mcp
OAUTH_AUDIENCE=https://mcp-wiki.grupoultra.com.br/mcp
OAUTH_REQUIRED_SCOPES=wiki.read
OAUTH_ALLOWED_ALGORITHMS=RS256
OAUTH_CLOCK_TOLERANCE_SECONDS=5
OAUTH_RESOURCE_DOCUMENTATION_URL=https://mcp-wiki.grupoultra.com.br/docs
```

`OAUTH_ISSUER_URL` deve ser exatamente igual ao claim `iss`. Se
`OAUTH_AUDIENCE` ficar vazio, o servidor espera `OAUTH_RESOURCE_URL` no claim
`aud`. Não inclua barra final ou outra variação que o provedor não emita.

## Endpoints públicos

```text
GET /health
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-protected-resource/mcp
```

Os endpoints de metadata não contêm segredos. `/mcp` permanece protegido e
responde 403 quando o JWT é válido, mas não possui todos os escopos requeridos.

## Cadastro do cliente ChatGPT

Na criação do app no ChatGPT Workspace, copie a redirect URI exibida pela
interface e cadastre-a exatamente no Authorization Server. O formato de
produção é `https://chatgpt.com/connector/oauth/{callback_id}`. Não invente o
`callback_id` e não use redirect URI de outro app/Workspace.

O fluxo do ChatGPT é em nome do usuário. Client Credentials/M2M, service account
e chave estática não substituem esse fluxo para autenticação de usuários.

Referências: [Autenticação de apps do ChatGPT](https://developers.openai.com/plugins/build/auth)
e [Remote MCP servers](https://developers.openai.com/api/docs/guides/tools-connectors-mcp).
