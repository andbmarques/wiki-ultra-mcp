# AGENTS.md

## Projeto

**Nome:** Ultra Wiki MCP  
**Objetivo:** desenvolver um servidor MCP (Model Context Protocol) para integrar a Wiki corporativa do Grupo Ultra, baseada em Wiki.js, ao ChatGPT Workspace.

A Wiki.js é a fonte oficial de procedimentos, políticas, processos e documentação interna do Grupo Ultra.

O MCP deverá atuar como uma camada intermediária segura entre o ChatGPT e o Wiki.js.

---

# 1. Contexto

O Grupo Ultra mantém uma Wiki corporativa em Wiki.js contendo documentação interna em Markdown.

Exemplos de áreas existentes:

- Comercial
- Operacional
- Departamento Pessoal
- Financeiro
- Administrativo
- Inteligência Artificial e Automações

Exemplos de documentos existentes:

- Procedimento de Venda
- Procedimento de Retenção
- Procedimento de Admissão
- Procedimento de Fechamento de Ordem de Serviço
- Procedimento de Renegociação de Débitos

A Wiki deve ser considerada a **fonte oficial da verdade** para os procedimentos internos da empresa.

Princípio institucional:

> Se uma informação não está na Wiki, ela ainda não faz parte do processo oficial do Grupo Ultra.

---

# 2. Arquitetura Esperada

A arquitetura deverá seguir este modelo:

```text
┌─────────────────────────────┐
│      ChatGPT Workspace      │
│                             │
│  Usuários do Grupo Ultra    │
└──────────────┬──────────────┘
               │
               │ MCP / HTTPS
               ▼
┌─────────────────────────────┐
│      ultra-wiki-mcp         │
│                             │
│  Autenticação               │
│  Controle de permissões     │
│  Validação                  │
│  Logs / Auditoria           │
│  Tools MCP                  │
└──────────────┬──────────────┘
               │
               │ GraphQL
               ▼
┌─────────────────────────────┐
│          Wiki.js            │
│                             │
│          /graphql           │
│                             │
│  Páginas Markdown           │
│  Busca                      │
│  Histórico                  │
│  Permissões                 │
└──────────────┬──────────────┘
               │
               ▼
          PostgreSQL
```

O MCP **não deve acessar diretamente o PostgreSQL**.

Toda leitura ou alteração da Wiki deverá ocorrer através da API do Wiki.js, preferencialmente via GraphQL.

---

# 3. Tecnologias

Utilizar preferencialmente:

- Node.js
- TypeScript
- MCP SDK oficial
- GraphQL
- Docker
- Docker Compose
- HTTPS em produção

O projeto deverá ser executável como um serviço independente.

---

# 4. Nome do Serviço

Nome padrão:

```text
ultra-wiki-mcp
```

Sugestões de endpoint em produção:

```text
https://mcp-wiki.grupoultra.com.br
```

ou:

```text
https://mcp.grupoultra.com.br/wiki
```

O domínio definitivo deve permanecer configurável por variável de ambiente.

---

# 5. Escopo da Primeira Versão

A versão inicial deverá ser **somente leitura**.

## MCP v0.1

Implementar:

```text
search_pages
get_page
list_pages
```

Não implementar inicialmente:

```text
create_page
update_page
move_page
delete_page
user_management
permission_management
```

A prioridade é criar uma integração segura e confiável para consulta da documentação existente.

---

# 6. Tools MCP

## 6.1 search_pages

Objetivo:

Pesquisar páginas da Wiki usando texto livre.

Exemplo de entrada:

```json
{
  "query": "admissão"
}
```

Resposta esperada:

```json
{
  "results": [
    {
      "title": "Procedimento de Admissão de Colaboradores",
      "path": "/procedimento-admissao",
      "description": "Procedimento oficial de admissão de colaboradores"
    }
  ]
}
```

A busca deverá priorizar:

1. título;
2. caminho;
3. conteúdo;
4. descrição da página, quando disponível.

Sempre que possível, retornar resultados ordenados por relevância.

---

## 6.2 get_page

Objetivo:

Obter o conteúdo completo de uma página da Wiki.

Aceitar preferencialmente:

```json
{
  "path": "/procedimento-admissao"
}
```

Se a API do Wiki.js trabalhar melhor com IDs, o MCP poderá resolver internamente o `path` para `pageId`.

Resposta esperada:

```json
{
  "title": "Procedimento de Admissão de Colaboradores",
  "path": "/procedimento-admissao",
  "content": "# Procedimento...",
  "contentType": "markdown",
  "source": "Wiki Oficial do Grupo Ultra"
}
```

Sempre retornar o conteúdo original em Markdown quando disponível.

Não converter o documento para HTML se o Markdown original estiver acessível.

---

## 6.3 list_pages

Objetivo:

Listar páginas disponíveis na Wiki.

Parâmetros opcionais:

```json
{
  "prefix": "/comercial",
  "limit": 100
}
```

Resposta esperada:

```json
{
  "pages": [
    {
      "title": "Comercial",
      "path": "/comercial"
    },
    {
      "title": "Procedimento de Venda",
      "path": "/procedimento-vendas"
    }
  ]
}
```

O `limit` deve possuir um teto seguro configurado no servidor.

---

# 7. Metadados das Respostas

Nunca retornar apenas o conteúdo bruto quando for possível identificar a origem.

Cada página deverá conter metadados suficientes para permitir rastreabilidade.

Formato preferencial:

```json
{
  "title": "Procedimento de Admissão de Colaboradores",
  "path": "/procedimento-admissao",
  "content": "...",
  "contentType": "markdown",
  "source": "Wiki Oficial do Grupo Ultra"
}
```

Se disponíveis na API, considerar também:

```json
{
  "pageId": 123,
  "description": "...",
  "locale": "pt-br",
  "updatedAt": "...",
  "updatedBy": "..."
}
```

Esses campos adicionais não devem impedir o funcionamento caso não estejam disponíveis.

---

# 8. Princípios de Segurança

## 8.1 Nunca expor credenciais

Credenciais da API Wiki.js nunca podem:

- aparecer em respostas MCP;
- ser incluídas em logs;
- ser hardcoded no código;
- ser commitadas no repositório;
- ser enviadas ao ChatGPT.

Usar exclusivamente variáveis de ambiente.

Exemplo:

```env
WIKI_URL=https://wiki.grupoultra.com.br
WIKI_API_TOKEN=...
```

---

## 8.2 Conta de serviço

Criar uma credencial específica para o MCP.

A conta deverá possuir apenas as permissões necessárias.

Na v0.1, usar permissões exclusivamente de leitura.

Evitar utilizar credenciais administrativas do Wiki.js.

---

## 8.3 Sem acesso direto ao banco

É proibido implementar consultas diretas ao PostgreSQL para leitura ou escrita de páginas.

A camada oficial deve permanecer:

```text
MCP
 ↓
Wiki.js API
 ↓
Wiki.js
 ↓
PostgreSQL
```

---

## 8.4 Validação

Todo input recebido pelas tools deve ser validado.

Validar pelo menos:

- tamanho da consulta;
- caracteres inválidos;
- limite de resultados;
- paths;
- payload máximo;
- timeouts;
- respostas inesperadas do Wiki.js.

Utilizar uma biblioteca de schema validation quando apropriado.

Exemplo:

```text
zod
```

---

# 9. Tratamento de Erros

Nunca retornar stack traces internos aos usuários.

Erros devem ser convertidos para mensagens MCP seguras.

Exemplos:

```text
Página não encontrada.
```

```text
Não foi possível consultar a Wiki neste momento.
```

```text
A consulta excede o tamanho permitido.
```

Registrar detalhes técnicos somente no log do servidor.

---

# 10. Logs e Auditoria

Criar logs estruturados.

Registrar:

- tool executada;
- timestamp;
- duração;
- resultado;
- erro técnico;
- quantidade de resultados;
- path consultado.

Evitar registrar:

- token da Wiki;
- cabeçalhos Authorization;
- conteúdo integral de páginas, salvo necessidade específica;
- dados sensíveis.

Exemplo:

```json
{
  "event": "get_page",
  "path": "/procedimento-admissao",
  "durationMs": 124,
  "status": "success"
}
```

---

# 11. Estrutura do Projeto

Estrutura preferencial:

```text
ultra-wiki-mcp/
│
├── src/
│   ├── index.ts
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── wikijs/
│   │   ├── client.ts
│   │   ├── pages.ts
│   │   └── search.ts
│   │
│   ├── tools/
│   │   ├── search-pages.ts
│   │   ├── get-page.ts
│   │   └── list-pages.ts
│   │
│   ├── schemas/
│   │   ├── search-pages.ts
│   │   ├── get-page.ts
│   │   └── list-pages.ts
│   │
│   ├── security/
│   │   ├── auth.ts
│   │   └── permissions.ts
│   │
│   └── logging/
│       └── logger.ts
│
├── tests/
│
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── README.md
└── AGENTS.md
```

A estrutura pode ser ajustada se houver justificativa técnica, mas deve permanecer modular.

---

# 12. Cliente Wiki.js

Centralizar todas as chamadas ao Wiki.js.

Arquivo sugerido:

```text
src/wikijs/client.ts
```

Responsabilidades:

- URL base;
- autenticação;
- headers;
- timeout;
- tratamento de respostas;
- erros GraphQL;
- retry limitado quando seguro.

Não duplicar chamadas HTTP em cada tool.

---

# 13. GraphQL

Antes de implementar queries definitivas, identificar a versão do Wiki.js instalada e validar o schema GraphQL disponível.

O código não deve assumir cegamente um schema de outra versão.

Durante a implementação:

1. verificar o endpoint `/graphql`;
2. identificar as queries disponíveis;
3. testar autenticação;
4. testar leitura de páginas;
5. testar busca;
6. adaptar os modelos internos.

Manter as queries GraphQL centralizadas.

Exemplo:

```text
src/wikijs/pages.ts
```

Evitar espalhar strings GraphQL por múltiplos arquivos.

---

# 14. Variáveis de Ambiente

Criar `.env.example`.

Exemplo:

```env
NODE_ENV=development

PORT=3001

WIKI_URL=https://wiki.example.com
WIKI_API_TOKEN=

MCP_BASE_URL=http://localhost:3001

LOG_LEVEL=info

WIKI_TIMEOUT_MS=10000

SEARCH_MAX_RESULTS=20
LIST_MAX_RESULTS=100
```

Nunca incluir credenciais reais.

---

# 15. Docker

Criar `Dockerfile` para produção.

Requisitos:

- imagem Node LTS;
- build TypeScript;
- execução com usuário não-root quando possível;
- apenas dependências necessárias em runtime;
- healthcheck quando apropriado.

Criar também:

```text
docker-compose.yml
```

O serviço MCP deve poder executar ao lado do Wiki.js.

Exemplo conceitual:

```yaml
services:
  ultra-wiki-mcp:
    build: .
    restart: unless-stopped
    environment:
      WIKI_URL: ${WIKI_URL}
      WIKI_API_TOKEN: ${WIKI_API_TOKEN}
    ports:
      - "3001:3001"
```

Não alterar containers existentes do Wiki.js sem necessidade.

---

# 16. Testes

Criar testes para:

## Cliente Wiki.js

- autenticação;
- erro HTTP;
- erro GraphQL;
- timeout;
- página inexistente.

## search_pages

- busca válida;
- query vazia;
- query muito longa;
- nenhum resultado;
- múltiplos resultados.

## get_page

- path válido;
- path inexistente;
- retorno Markdown;
- metadados.

## list_pages

- listagem padrão;
- prefixo;
- limite;
- limite máximo.

Sempre que possível, mockar a API Wiki.js nos testes unitários.

---

# 17. Health Check

Disponibilizar endpoint simples para verificar se o MCP está ativo.

Exemplo:

```text
GET /health
```

Resposta:

```json
{
  "status": "ok"
}
```

Opcionalmente criar:

```text
GET /ready
```

que poderá validar conectividade com o Wiki.js.

Não expor credenciais ou informações sensíveis nesses endpoints.

---

# 18. Integração com ChatGPT Workspace

O MCP deverá ser desenvolvido como um **Remote MCP Server**, acessível via HTTPS.

A configuração final deverá fornecer ao administrador do ChatGPT Workspace um endpoint MCP remoto.

O servidor deve permitir que o ChatGPT descubra as tools:

```text
search_pages
get_page
list_pages
```

Descrições das tools devem deixar claro que:

- a Wiki pertence ao Grupo Ultra;
- o conteúdo é documentação interna;
- os resultados são a fonte oficial dos procedimentos;
- a tool não deve inventar conteúdo ausente.

---

# 19. Comportamento Esperado do ChatGPT

O MCP deve fornecer informações estruturadas suficientes para respostas como:

```text
Segundo o Procedimento de Admissão de Colaboradores, o contrato
de trabalho deve estar assinado antes do início das atividades.

Fonte:
Wiki Grupo Ultra
Departamento Pessoal
Procedimento de Admissão
```

O ChatGPT poderá resumir a página, mas o MCP deve sempre preservar acesso ao conteúdo original e à sua origem.

---

# 20. Evolução Planejada

## v0.1 — leitura

```text
search_pages
get_page
list_pages
```

## v0.2 — escrita controlada

Planejado:

```text
create_page
update_page
move_page
```

Essas funções **não devem ser implementadas na v0.1**, salvo instrução explícita.

---

# 21. Modelo de Permissões Futuro

Quando escrita for implementada, organizar as permissões conceitualmente em:

```text
READ
├── search_pages
├── get_page
└── list_pages

WRITE
├── create_page
├── update_page
└── move_page

ADMIN
├── delete_page
├── users
└── permissions
```

Operações administrativas não devem ser disponibilizadas ao ChatGPT por padrão.

---

# 22. Exclusão de Páginas

Não implementar `delete_page` inicialmente.

Mesmo em versões futuras, exclusão deve exigir controles adicionais.

Preferir:

- histórico;
- versionamento;
- arquivamento;
- restauração;

antes de exclusão definitiva.

---

# 23. Escrita Futura

Quando `update_page` for implementado, a sequência esperada será:

```text
Usuário solicita alteração
          │
          ▼
ChatGPT prepara conteúdo
          │
          ▼
MCP valida solicitação
          │
          ├── página existe?
          ├── permissão válida?
          ├── conteúdo válido?
          ├── Markdown válido?
          └── tamanho permitido?
          │
          ▼
Wiki.js API
          │
          ▼
Nova revisão da página
```

O histórico/versionamento do Wiki.js deve ser preservado.

---

# 24. Regras para o Codex

Ao trabalhar neste repositório:

1. Leia este arquivo inteiro antes de modificar código.
2. Não implemente recursos fora do escopo sem necessidade.
3. Preserve a arquitetura modular.
4. Não acesse diretamente o banco de dados.
5. Não hardcode credenciais.
6. Não exponha tokens em logs.
7. Não implemente escrita durante a v0.1.
8. Não implemente exclusão.
9. Valide inputs de todas as tools.
10. Prefira TypeScript estrito.
11. Documente decisões relevantes.
12. Adicione testes para funcionalidades novas.
13. Atualize o README quando houver mudança de comportamento.
14. Não altere o Wiki.js diretamente.
15. Não execute migrações ou comandos destrutivos sem solicitação explícita.

---

# 25. Qualidade do Código

Usar:

- TypeScript strict;
- funções pequenas;
- nomes explícitos;
- interfaces claras;
- validação de dados;
- tratamento de erros;
- baixo acoplamento;
- logs estruturados.

Evitar:

- `any` sem justificativa;
- código duplicado;
- funções gigantes;
- dependências desnecessárias;
- chamadas HTTP espalhadas;
- catches silenciosos;
- segredos no código.

---

# 26. Critério de Pronto da v0.1

A primeira versão estará pronta quando:

- [ ] servidor MCP iniciar corretamente;
- [ ] configuração ocorrer exclusivamente via ambiente;
- [ ] conexão autenticada com Wiki.js funcionar;
- [ ] `search_pages` funcionar;
- [ ] `get_page` funcionar;
- [ ] `list_pages` funcionar;
- [ ] conteúdo Markdown original for retornado;
- [ ] título e path forem retornados;
- [ ] erros forem tratados;
- [ ] logs estruturados existirem;
- [ ] segredos não aparecerem em logs;
- [ ] Dockerfile funcionar;
- [ ] docker-compose funcionar;
- [ ] endpoint de healthcheck funcionar;
- [ ] testes principais passarem;
- [ ] README explicar instalação e configuração;
- [ ] servidor puder ser publicado via HTTPS;
- [ ] endpoint puder ser configurado como Remote MCP no ChatGPT Workspace.

---

# 27. Primeira Tarefa de Implementação

Antes de escrever o servidor completo:

1. identificar a versão exata do Wiki.js em uso;
2. confirmar disponibilidade do endpoint GraphQL;
3. identificar o método de autenticação suportado;
4. testar uma query simples;
5. descobrir as queries reais para:
   - listar páginas;
   - obter página;
   - pesquisar páginas;
6. documentar o schema necessário;
7. somente então implementar o cliente `wikijs`.

Se houver diferença entre a API real da instalação e qualquer exemplo presente neste documento, **a API real da instalação é a fonte de verdade técnica**.

Não inventar queries GraphQL.

---

# 28. Resultado Esperado

Ao final da v0.1, um usuário no ChatGPT Workspace deverá poder perguntar, por exemplo:

```text
Como funciona o procedimento de admissão?
```

O ChatGPT deverá conseguir:

```text
search_pages("admissão")
        ↓
get_page("/procedimento-admissao")
        ↓
receber o Markdown oficial
        ↓
responder com base na documentação
```

Outro exemplo:

```text
Qual o código da ONU Intelbras R1?
```

O MCP deverá localizar a documentação relevante e permitir que o ChatGPT responda usando a informação registrada oficialmente na Wiki.

---

# 29. Princípio Final

O MCP não é uma nova fonte de conhecimento.

Ele é apenas uma interface segura para a fonte oficial existente.

```text
Wiki.js = fonte da verdade
MCP = camada de acesso
ChatGPT = interface de consulta
```

Toda implementação deve preservar esse princípio.

# Autonomia do Agente

O Codex deve executar as tarefas deste projeto de forma autônoma.

## Regra principal

Não interrompa o trabalho para pedir confirmação, aprovação ou esclarecimentos quando houver uma solução razoável que possa ser inferida a partir:

- deste AGENTS.md;
- do código existente;
- do README;
- da estrutura do projeto;
- dos testes;
- das configurações existentes;
- das convenções já utilizadas no repositório.

Quando houver ambiguidade, escolha a alternativa tecnicamente mais segura e consistente com o projeto e continue.

## Durante a implementação

O agente está autorizado a:

- criar arquivos;
- editar arquivos existentes;
- mover ou renomear arquivos quando necessário;
- instalar dependências necessárias;
- executar comandos de build;
- executar testes;
- executar lint e typecheck;
- corrigir erros encontrados durante os testes;
- criar arquivos de configuração;
- atualizar README;
- criar ou ajustar Dockerfile e docker-compose;
- criar testes;
- refatorar código necessário para concluir a tarefa.

Não pedir confirmação para essas ações.

## Resolução automática de problemas

Se um comando falhar:

1. analise o erro;
2. tente corrigir a causa;
3. execute novamente;
4. continue até que o problema seja resolvido ou exista um bloqueio externo real.

Não pare após o primeiro erro.

Se testes falharem devido às alterações realizadas, corrija-os antes de finalizar.

## Dependências

Se uma dependência for claramente necessária para implementar a tarefa, instale-a sem solicitar confirmação.

Prefira dependências:

- maduras;
- amplamente utilizadas;
- mantidas;
- compatíveis com a stack existente.

Evite adicionar dependências quando a funcionalidade puder ser implementada de forma simples com as bibliotecas já existentes.

## Decisões técnicas

Quando houver várias soluções válidas:

1. prefira a solução mais simples;
2. preserve a arquitetura existente;
3. minimize novas dependências;
4. mantenha compatibilidade com o código existente;
5. priorize segurança e manutenção.

Não solicite ao usuário que escolha entre alternativas equivalentes.

## Verificação obrigatória

Antes de considerar uma tarefa concluída:

1. execute os testes relevantes;
2. execute o typecheck;
3. execute o lint, quando existir;
4. execute o build;
5. corrija problemas causados pelas alterações;
6. revise o diff final.

Não considere a tarefa concluída apenas porque o código foi escrito.

## Quando perguntar

Somente interrompa o usuário se existir um bloqueio que não possa ser resolvido pelo próprio repositório, por exemplo:

- credencial externa obrigatória inexistente;
- informação de negócio impossível de inferir;
- acesso externo que não está disponível;
- decisão irreversível com risco significativo de perda de dados;
- duas interpretações incompatíveis que produziriam comportamentos de negócio materialmente diferentes.

Mesmo nesses casos, antes de perguntar:

1. investigue o repositório;
2. procure documentação;
3. verifique arquivos de configuração;
4. tente alternativas seguras.

## Regra contra perguntas desnecessárias

Não faça perguntas como:

- "Posso continuar?"
- "Deseja que eu implemente?"
- "Quer que eu execute os testes?"
- "Posso instalar a dependência?"
- "Deseja que eu corrija os erros?"
- "Devo criar esse arquivo?"
- "Quer que eu prossiga com a próxima etapa?"

A resposta para essas perguntas é sempre: sim.

Continue trabalhando até concluir a tarefa solicitada.
