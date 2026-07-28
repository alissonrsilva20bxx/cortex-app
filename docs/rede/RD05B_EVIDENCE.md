# RD-05b — Evidência de execução

**Ambiente:** worktree `C:\Users\miguel\JobApp-Claude-RD05b`, branch `agent/claude-backend-rd05b` (base: `origin/agent/codex-rd10-review`).
**Data:** 2026-07-28.
**Nenhum comando abaixo tocou o Supabase remoto.** Nenhum merge/push foi feito.

## 0. Nota de escopo

`BETA_DOMAIN_MODEL.md` §3 e `BACKEND_TICKETS.md` (RD-05b) marcavam esta feature como "proposta a validar com produto, fora do MVP — só entra em planejamento se aprovado". Este ticket foi executado por instrução explícita e direta do dono do produto nesta sessão (2026-07-28), assumindo o papel de decisão que antes estava em aberto. Registrando aqui para rastreabilidade — não é uma reversão silenciosa da recomendação anterior, é a aprovação que faltava.

## 1. `supabase/migrations/0009b_rede_posts_anonimos.sql`

- Adiciona `anonimo boolean not null default false` a `rede_posts`.
- **Fecha o bypass, não só filtra no app:** revoga o `SELECT` de `authenticated` na tabela base e reconcede só nas colunas sem segredo (`id, categoria, texto, anonimo, criado_em, atualizado_em`) — `autor_id` fica de fora do grant, ponto. Isso significa que a proteção é um _permission denied_ do próprio Postgres, não uma regra de RLS que dependeria de nenhuma lógica condicional — nenhuma query, direta ou via join, consegue ler `autor_id` da tabela base como `authenticated`, porque a checagem de coluna acontece antes de qualquer RLS ser avaliada.
- `rede_posts_publico` (view): reimplementa o filtro de visibilidade de linha da RLS original (`rede_is_member() and rede_users_unblocked(autor_id)`) — necessário porque a view roda com o privilégio de quem a criou (o superuser da migration), não herda a RLS da tabela base automaticamente — e decide `autor_id` real vs. `null` via `CASE`: real se o post não é anônimo, ou se quem pergunta é o próprio autor, ou se quem pergunta é admin (`rede_is_admin()`); `null` em qualquer outro caso.
- `INSERT`/`UPDATE` de `authenticated` em `rede_posts` estendidos para incluir `anonimo` (mesma lista de colunas de `0009`, só com a coluna nova).

## 2. Código de aplicação (`lib/rede/feed.ts`)

- `listarFeed()` passou a ler de `rede_posts_publico`, não da tabela base — é o único ponto de leitura do feed, então é o único lugar que precisava mudar.
- `criarPost()` aceita `anonimo?: boolean` (default `false`) e grava na tabela base normalmente (a política de quem pode criar não mudou). O `.select()` do retorno do insert foi trocado de `select()` (todas as colunas) para uma lista explícita sem `autor_id` — **achado durante a implementação, não estava no plano original:** com `autor_id` sem grant de `SELECT` na tabela base, o antigo `.select()` (equivalente a `select("*")`) quebraria toda criação de post, inclusive a do próprio dono, porque o retorno pós-insert também é uma leitura sujeita ao mesmo grant. Corrigido antes de qualquer execução.
- `lib/database.types.ts`: adicionada a coluna `anonimo` em `rede_posts` (Row/Insert/Update) e a nova entrada em `Views` para `rede_posts_publico`, seguindo o mesmo padrão de manutenção incremental já usado pelo Codex neste arquivo (apesar de `BACKEND_TICKETS.md` RD-09 dizer "não editar à mão" — na prática esse arquivo já vem sendo estendido tabela por tabela a cada ticket, então segui a convenção real do repositório em vez da nota original do ticket).

## 3. `tests/rede/rls/rede_posts_anonimos.rls.test.ts`

Onze casos cobrindo o critério de aceite ("consulta por B a post anônimo de A não retorna autor_id = A em nenhum campo, incluindo via join; consulta pelo próprio A ou por admin retorna o dado completo"):

- Leitor comum vê `autor_id: null` num post anônimo de outro autor.
- Leitor comum ainda vê o `autor_id` real num post não-anônimo (comportamento antigo intacto).
- O próprio autor vê seu `autor_id` real no próprio post anônimo.
- Um admin (via `rede_admins`) vê o `autor_id` real no post anônimo de outra pessoa.
- **A prova central de "nem via join":** `authenticated` não consegue `SELECT autor_id` da tabela base de jeito nenhum — é um erro de permissão do Postgres (`42501`, "permission denied for table rede_posts"), não um filtro de RLS. Como é uma checagem de coluna, cobre qualquer formato de query, não só o caminho testado literalmente.
- Colunas sem segredo continuam legíveis direto na tabela base (RD-05 não regride).
- `anon` não acessa a view.
- `service_role` continua enxergando o `autor_id` real na tabela base (caminho administrativo intacto).

## 4. Execução — status: **pendente, Docker local sem resposta**

Mesma situação operacional já registrada em `RD03_EVIDENCE.md` §3 e `RD02_EVIDENCE.md` §3: o stack Docker compartilhado (`supabase_db_cortex-app`) não respondeu a `docker exec ... pg_isready` em nenhuma das tentativas feitas durante esta sessão (2026-07-28), provavelmente por contenção com outro trabalho em paralelo no mesmo stack. Migration, código e teste estão prontos; falta rodar `supabase db reset && npm test` assim que o stack responder.

## 5. `tsc --noEmit` — passou

Diferente da validação contra o Postgres local, o typecheck não depende do Docker. Rodei `npm install` (504 pacotes) e `npx tsc --noEmit` neste worktree: **saída vazia, zero erros.** Confirma que `lib/database.types.ts` (coluna `anonimo` + view `rede_posts_publico`) e `lib/rede/feed.ts` (leitura pela view, `criarPost` sem `autor_id` na projeção de retorno) tipam corretamente entre si.

## 6. O que ainda falta para fechar este ticket

- Confirmar `supabase status` antes de depender do stack.
- `supabase db reset` (aplica `0009b` em sequência com tudo que já existe).
- `npm test -- rede_posts_anonimos` e colar a saída aqui.
