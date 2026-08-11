# Teste e implantação do Ultra Wiki MCP

Este documento descreve o caminho entre o código local e a disponibilização do
MCP no ChatGPT Workspace. Execute as etapas na ordem apresentada.

## 1. Situação atual

O projeto já fornece:

- servidor MCP remoto em `POST /mcp` usando Streamable HTTP;
- tools somente leitura `search_pages` e `get_page`;
- leitura GraphQL por `pages.singleByPath(path, locale)`;
- conteúdo original e metadados da Wiki;
- healthcheck em `GET /health`;
- autenticação da Wiki com `WIKI_API_TOKEN`;
- OAuth 2.1 em produção com descoberta, JWT/JWKS e escopo `wiki.read`;
- `MCP_API_KEY` somente para testes locais com o Inspector;
- testes, build TypeScript, Dockerfile e Docker Compose.

O que ainda depende de ação externa:

1. criar uma conta/token de serviço somente leitura no Wiki.js;
2. escolher uma página real para o teste;
3. confirmar o build exato do Wiki.js com um usuário autorizado ou no painel;
4. publicar o MCP por HTTPS ou usar um túnel MCP seguro;
5. cadastrar e testar o app no ChatGPT Workspace;
6. configurar um Authorization Server/OIDC corporativo compatível com o fluxo
   Authorization Code + PKCE utilizado pelo ChatGPT.

## 2. Pré-requisitos

Para teste local:

- Node.js 22 ou superior;
- npm;
- acesso de rede a `https://wiki.grupoultralinknet.com.br`;
- token Wiki.js somente leitura;
- caminho de uma página que esse token possa consultar.

Para implantação:

- servidor Linux ou plataforma de containers;
- Docker Engine e Docker Compose;
- DNS para `wikimcp.grupoultralinknet.com.br`;
- certificado HTTPS válido;
- saída HTTPS do MCP para a Wiki;
- acesso administrativo ao ChatGPT Business, Enterprise ou Edu;
- cofre de segredos ou mecanismo equivalente.

Não é necessário e não é permitido fornecer acesso ao PostgreSQL.

## 3. Criar a credencial de leitura no Wiki.js

No Wiki.js 2.x:

1. Entre na administração da Wiki.
2. Acesse a área de API, normalmente **Administration > API Access**.
3. Crie uma credencial exclusiva para `ultra-wiki-mcp`.
4. Conceda somente permissão de leitura às áreas que poderão ser consultadas.
5. Não use um token de administrador.
6. Armazene o token em um cofre de segredos.
7. Não envie o token ao ChatGPT e não o coloque em arquivos versionados.

O token será enviado pelo servidor ao Wiki.js neste formato:

```text
Authorization: Bearer <WIKI_API_TOKEN>
```

Para descobrir a versão exata, prefira o painel administrativo do Wiki.js. A
query `system.info.currentVersion` também pode funcionar, mas não aumente as
permissões da conta de serviço apenas para obter essa informação.

Registre a versão confirmada em [`docs/wikijs-schema.md`](docs/wikijs-schema.md).

## 4. Preparar o ambiente local

Na raiz do projeto:

```powershell
npm ci
Copy-Item .env.example .env
```

Edite `.env`:

```env
NODE_ENV=development
PORT=3001

WIKI_URL=https://wiki.grupoultralinknet.com.br
WIKI_API_TOKEN=COLOQUE_O_TOKEN_SOMENTE_LEITURA_AQUI
WIKI_LOCALE=pt-br
WIKI_TIMEOUT_MS=10000
SEARCH_MAX_RESULTS=20

MCP_AUTH_MODE=api-key
MCP_API_KEY=COLOQUE_UMA_CHAVE_ALEATORIA_LONGA_AQUI
MCP_BASE_URL=http://localhost:3001

LOG_LEVEL=info
MAX_PAGE_CONTENT_BYTES=2000000
```

Para gerar uma chave MCP aleatória no PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

O arquivo `.env` está ignorado pelo Git. Confirme que ele não aparece em:

```powershell
git status --short
```

## 5. Executar a verificação obrigatória

Antes de iniciar o serviço:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Todos os comandos devem terminar sem erro. Atualmente a suíte cobre cliente
GraphQL, autenticação, timeout, limites, metadados, healthcheck e descoberta da
tool pelo protocolo MCP.

## 6. Iniciar e verificar o serviço local

Durante desenvolvimento:

```powershell
npm run dev
```

Ou execute o artefato compilado:

```powershell
npm run build
npm start
```

Em outro terminal, teste o healthcheck:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Resposta esperada:

```json
{"status":"ok"}
```

O healthcheck indica que o processo está ativo. Ele não garante que o token da
Wiki consegue ler páginas.

## 7. Testar o MCP localmente

Use um cliente que suporte MCP Streamable HTTP, como o MCP Inspector:

```powershell
npx @modelcontextprotocol/inspector
```

Na interface do Inspector:

1. Selecione **Streamable HTTP**.
2. Informe `http://localhost:3001/mcp`.
3. Adicione o header `Authorization` com o valor
   `Bearer <valor-de-MCP_API_KEY>`.
4. Conecte.
5. Abra a lista de tools.
6. Confirme que `search_pages` e `get_page` foram descobertas.
7. Execute `search_pages` com um termo presente na Wiki.

Exemplo:

```json
{
  "query": "admissão",
  "limit": 10,
  "locale": "pt-br"
}
```

8. Escolha o `path` de um resultado e execute `get_page` com uma página real.

Exemplo:

```json
{
  "path": "/caminho-real-da-pagina",
  "locale": "pt-br"
}
```

Confirme que a resposta contém:

- `title` correto;
- `path` correto;
- `content` em Markdown;
- `contentType` esperado;
- `source` igual a `Wiki Oficial do Grupo Ultra`;
- `pageId`, `locale`, datas e autor;
- nenhum token ou stack trace.

Também teste os erros:

1. path inexistente: deve retornar `Página não encontrada.`;
2. path inválido: deve ser rejeitado pela validação MCP;
3. `MCP_API_KEY` incorreta: deve retornar HTTP 401;
4. token Wiki inválido: deve retornar mensagem segura de autenticação;
5. Wiki temporariamente inacessível: não deve retornar stack trace.

## 8. Critério de aprovação do teste local

O piloto local está aprovado quando:

- [ ] testes, typecheck, lint e build passam;
- [ ] `/health` responde `200`;
- [ ] o Inspector descobre `get_page`;
- [ ] o Inspector descobre `search_pages`;
- [ ] uma busca real retorna resultados relevantes e metadados de origem;
- [ ] uma página real é retornada em Markdown;
- [ ] título, path e origem estão corretos;
- [ ] o token da Wiki tem apenas leitura;
- [ ] credenciais não aparecem nos logs;
- [ ] erros retornam mensagens seguras;
- [ ] o conteúdo retornado corresponde ao conteúdo oficial da Wiki.

## 9. Testar com Docker

Com Docker instalado, mantenha as variáveis no `.env` e execute:

```powershell
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail 100 ultra-wiki-mcp
```

Use `docker compose config --quiet`: executar `docker compose config` sem essa
opção pode imprimir valores resolvidos, incluindo segredos, no terminal ou CI.

Teste:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Para encerrar o ambiente de teste:

```powershell
docker compose down
```

Esse comando remove o container e a rede do Compose, mas não deve remover
volumes ou dados da Wiki. O MCP não deve compartilhar o banco da Wiki.

## 10. Escolher como o ChatGPT alcançará o MCP

Existem duas opções seguras.

### Opção A — endpoint público HTTPS

Use quando o MCP puder ser publicado na internet com autenticação forte:

```text
https://wikimcp.grupoultralinknet.com.br/mcp
```

Requisitos:

- TLS válido;
- autenticação aceita pelo ChatGPT Workspace;
- nenhum desafio HTML, CAPTCHA ou tela de login na rota `/mcp`;
- suporte a POST e respostas Streamable HTTP/SSE;
- proxy sem buffering indevido;
- timeout suficiente para chamadas MCP;
- proteção contra abuso e limitação de requisições.

### Opção B — Secure MCP Tunnel

Use quando o MCP permanecer em rede privada, on-premises ou atrás de firewall.
A documentação atual da OpenAI recomenda o Secure MCP Tunnel para esses casos,
evitando expor diretamente o servidor à internet:

- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Remote MCP servers](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)

Siga a documentação do túnel para instalar o cliente oficial, associar o
endpoint interno e obter a URL que será cadastrada no ChatGPT.

## 11. Preparar a implantação HTTPS

Configure o DNS do domínio escolhido para o servidor ou balanceador. No
ambiente de produção, defina no cofre de segredos:

```env
NODE_ENV=production
PORT=3001
WIKI_URL=https://wiki.grupoultralinknet.com.br
WIKI_API_TOKEN=<segredo-wiki-somente-leitura>
WIKI_LOCALE=pt-br
WIKI_TIMEOUT_MS=10000
SEARCH_MAX_RESULTS=20
MCP_BASE_URL=https://wikimcp.grupoultralinknet.com.br
MCP_AUTH_MODE=oauth
OAUTH_ISSUER_URL=https://login.exemplo.com/tenant
OAUTH_JWKS_URL=https://login.exemplo.com/tenant/.well-known/jwks.json
OAUTH_RESOURCE_URL=https://wikimcp.grupoultralinknet.com.br/mcp
OAUTH_AUDIENCE=https://wikimcp.grupoultralinknet.com.br/mcp
OAUTH_AUTHORIZATION_SCOPES=https://wikimcp.grupoultralinknet.com.br/mcp/wiki.read
OAUTH_REQUIRED_SCOPES=wiki.read
OAUTH_ALLOWED_ALGORITHMS=RS256
OAUTH_CLOCK_TOLERANCE_SECONDS=5
LOG_LEVEL=info
MAX_PAGE_CONTENT_BYTES=2000000
```

O projeto exige `MCP_AUTH_MODE=oauth`, issuer, JWKS e resource HTTPS quando
`NODE_ENV=production`. A configuração detalhada está em
[`docs/oauth.md`](docs/oauth.md).

Exemplo conceitual com Caddy:

```caddyfile
wikimcp.grupoultralinknet.com.br {
    encode zstd gzip
    reverse_proxy ultra-wiki-mcp:3001
}
```

Exemplo conceitual com Nginx:

```nginx
location / {
    proxy_pass http://ultra-wiki-mcp:3001;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 120s;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Não coloque os segredos no `Dockerfile`, no `docker-compose.yml`, em argumentos
de build ou no repositório.

## 12. Subir o serviço em produção

No servidor:

```bash
git clone <URL_DO_REPOSITORIO> ultra-wiki-mcp
cd ultra-wiki-mcp
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 ultra-wiki-mcp
```

Valide externamente:

```powershell
Invoke-RestMethod https://wikimcp.grupoultralinknet.com.br/health
```

Depois conecte o MCP Inspector à URL HTTPS e repita os testes de `search_pages`
e `get_page`.
Isso separa problemas de aplicação de problemas específicos do Workspace.

Verifique também:

- certificado e cadeia TLS válidos;
- ausência de redirect para login;
- ausência de página do Cloudflare ou WAF no `/mcp`;
- logs sem credenciais ou conteúdo integral;
- conectividade do container com a Wiki;
- reinício automático após reiniciar o host.

## 13. Configurar OAuth no ChatGPT Workspace

Antes de criar o app, configure o Authorization Server corporativo:

1. habilite Authorization Code com PKCE `S256`;
2. publique discovery OAuth/OIDC e JWKS por HTTPS;
3. registre o Application ID URI `https://wikimcp.grupoultralinknet.com.br/mcp`;
4. exponha e delegue o scope
   `https://wikimcp.grupoultralinknet.com.br/mcp/wiki.read`;
5. faça o access token JWT conter `iss`, `aud`, `exp`, identificação do cliente
   (`client_id`, `azp` ou equivalente) e `scope`/`scp`;
6. habilite CIMD, Dynamic Client Registration ou prepare um cliente OAuth
   previamente cadastrado, conforme o mecanismo aceito pelo Workspace;
7. copie da interface do ChatGPT a redirect URI específica do app e registre-a
   exatamente no provedor. O formato é
   `https://chatgpt.com/connector/oauth/{callback_id}`;
8. configure refresh tokens/offline access conforme a política corporativa.

Valide publicamente antes do cadastro:

```powershell
Invoke-RestMethod https://wikimcp.grupoultralinknet.com.br/.well-known/oauth-protected-resource/mcp
curl.exe -i https://wikimcp.grupoultralinknet.com.br/mcp
```

O primeiro comando deve retornar `resource`, `authorization_servers` e
`scopes_supported`, incluindo o scope totalmente qualificado. O segundo deve
retornar HTTP 401 e um header `WWW-Authenticate` cujo parâmetro `scope` também
seja totalmente qualificado. O access token do Entra continua sendo validado
por `scp=wiki.read`; um JWT válido sem esse valor deve retornar HTTP 403.

Não escolha **No authentication**. Bearer estático, Client Credentials/M2M e a
credencial de serviço do Wiki.js não autenticam o usuário do ChatGPT.

## 14. Cadastrar o MCP no ChatGPT Workspace

Segundo a documentação atual da OpenAI, apps MCP personalizados são testados no
ChatGPT web por meio do modo de desenvolvedor. A interface está em beta e os
nomes podem mudar.

### Habilitar o modo de desenvolvedor

Para Business:

1. Entre como Admin ou Owner.
2. Acesse **Workspace Settings > Apps > Create**.
3. Habilite o modo de desenvolvedor quando solicitado.

Para Enterprise/Edu:

1. O administrador concede acesso em
   **Workspace Settings > Permissions & Roles > Connected Data**.
2. O desenvolvedor autorizado ativa em
   **Settings > Apps > Advanced Settings**.
3. O administrador pode limitar o acesso por RBAC.

### Criar o app

1. Acesse **Workspace Settings > Apps > Create** ou
   **Settings > Apps > Create**, conforme a função do usuário.
2. Informe um nome, por exemplo `Wiki Oficial Grupo Ultra`.
3. Informe a URL:

   ```text
   https://wikimcp.grupoultralinknet.com.br/mcp
   ```

4. Escolha OAuth e configure o cliente conforme o Authorization Server.
5. Execute **Scan Tools**.
6. Confirme que `search_pages` e `get_page` foram descobertas como read-only.
7. Conclua a criação.
8. Confirme que o app aparece como rascunho/draft e com indicação de
   desenvolvimento.

Documentação oficial vigente:

- [Modo de desenvolvedor e apps MCP no ChatGPT](https://help.openai.com/pt-br/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta)
- [Controles de plugins e conectores](https://learn.chatgpt.com/docs/enterprise/apps-and-connectors)
- [Guia administrativo do Workspace](https://learn.chatgpt.com/docs/enterprise/admin-setup)

## 15. Testar dentro do ChatGPT

1. Abra um chat novo no ChatGPT web.
2. Selecione o app de desenvolvimento no menu de tools/apps.
3. Comece por uma solicitação em linguagem natural:

   ```text
   Como funciona o procedimento de admissão? Pesquise na Wiki Oficial do Grupo
   Ultra, leia a página mais relevante e informe título e path da fonte.
   ```

4. Verifique no histórico que `search_pages` foi executada antes de `get_page`.
5. Confirme que `get_page` recebeu um path retornado pela busca.
6. Compare a resposta com a página original da Wiki.
7. Confirme que o ChatGPT não inventou conteúdo ausente.
8. Teste com uma busca sem resultados e confira se o modelo não tenta preencher a
   informação por conta própria.

## 16. Publicar para o Workspace

Somente Admins/Owners devem publicar:

1. Acesse **Workspace Settings > Apps > Drafts**.
2. Abra o app da Wiki.
3. Revise a URL, autenticação e a tool descoberta.
4. No Enterprise/Edu, configure o público por grupo/RBAC.
5. Mantenha apenas ações de leitura habilitadas.
6. Publique primeiro para um grupo piloto.
7. Monitore erros, latência, paths consultados e volume de uso.
8. Expanda o acesso somente depois da validação do piloto.

O ChatGPT mantém um snapshot das tools aprovadas. Alterações futuras em nome,
schema ou parâmetros não são ativadas automaticamente. Depois de mudar uma
tool, o administrador deve atualizar/reescanear as ações e publicar a nova
versão. Evite mudanças incompatíveis em tools já publicadas.

## 17. Próximas implementações do projeto

Depois que busca e leitura funcionarem com páginas reais, siga esta ordem.

### Etapa 1 — concluir a v0.1 de leitura

- implementar `list_pages` com limite máximo;
- criar schemas Zod para todas as entradas;
- adicionar testes unitários e de integração;
- validar ordenação, locale e permissões com a instalação real;
- atualizar README, `docs/wikijs-schema.md` e este documento;
- repetir **Scan Tools** no Workspace.

### Etapa 2 — endurecimento para produção

- integrar o issuer OAuth já suportado ao diretório corporativo e revisar claims;
- adicionar rate limiting por identidade;
- criar `/ready` para conectividade controlada com a Wiki;
- adicionar métricas de latência, erro e volume;
- enviar logs a uma plataforma central de auditoria;
- definir retenção e acesso aos logs;
- automatizar rotação de segredos;
- adicionar CI para test, typecheck, lint, build e imagem Docker;
- realizar análise de dependências e imagem;
- testar indisponibilidade da Wiki e timeouts no ambiente publicado;
- revisar proteção contra prompt injection presente em conteúdo da Wiki.

### Etapa 3 — operação

- definir responsável técnico e responsável de negócio;
- criar alertas para erro e indisponibilidade;
- revisar trimestralmente permissões da conta Wiki;
- revisar periodicamente as tools aprovadas no Workspace;
- documentar rollback e rotação emergencial de tokens;
- manter escrita, exclusão e administração fora da v0.1.

## 18. Critério de pronto para produção

- [ ] conta Wiki exclusiva e somente leitura;
- [ ] versão do Wiki.js registrada;
- [ ] `get_page`, `search_pages` e `list_pages` validadas na Wiki real;
- [ ] testes, typecheck, lint e build aprovados no CI;
- [ ] imagem Docker validada;
- [ ] HTTPS ou Secure MCP Tunnel validado;
- [ ] autenticação individual/corporativa aprovada pela segurança;
- [ ] segredos armazenados fora do repositório;
- [ ] logs e retenção aprovados;
- [ ] app testado em modo de desenvolvedor;
- [ ] tools revisadas e aprovadas pelo administrador;
- [ ] acesso liberado inicialmente para grupo piloto;
- [ ] respostas comparadas com a Wiki oficial;
- [ ] procedimento de rollback testado;
- [ ] nenhuma operação de escrita ou exclusão disponível.

## 19. Rollback e incidentes

Para retirar o MCP do ar sem alterar a Wiki:

1. Desabilite o app no ChatGPT Workspace.
2. Pare apenas o serviço MCP:

   ```bash
   docker compose stop ultra-wiki-mcp
   ```

3. Revogue as sessões/tokens OAuth ou o cliente comprometido no Authorization Server.
4. Se necessário, revogue o token de serviço no Wiki.js.
5. Preserve os logs de auditoria conforme a política da empresa.
6. Corrija, teste e publique novamente.

O rollback do MCP não deve executar migrações, excluir páginas ou alterar os
containers e o banco de dados da Wiki.

## 20. Diagnóstico rápido

### `/health` não responde

- confirme que o processo/container está ativo;
- confirme a porta `3001`;
- verifique firewall, proxy e DNS;
- consulte os logs do container.

### `get_page` retorna erro de autenticação da Wiki

- confirme `WIKI_API_TOKEN` no ambiente do container;
- confirme que o token não expirou;
- confirme permissão de leitura para a página/locale;
- não aumente para permissão administrativa sem necessidade.

### O Inspector recebe HTTP 401

- em desenvolvimento, envie `Authorization: Bearer <MCP_API_KEY>`;
- em produção, confirme discovery, audience, issuer, expiração e `wiki.read`;
- confirme que o proxy preserva o header `Authorization` e
  `WWW-Authenticate`.

### O ChatGPT não consegue executar Scan Tools

- teste a mesma URL com o Inspector;
- confirme HTTPS e certificado;
- confirme que `/mcp` não redireciona para HTML/login;
- confirme autenticação compatível com o cadastro;
- confira buffering, timeout, WAF e desafios do proxy;
- se estiver em rede privada, use o Secure MCP Tunnel.

### A tool mudou e o ChatGPT usa o schema antigo

- atualize/reescan as ações no Workspace;
- revise o diff das tools;
- publique a atualização;
- teste novamente em um chat novo.
