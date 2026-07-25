# RD-17 — Evidência de execução

**Ambiente:** Supabase local (`supabase start`, Docker), worktree `agent/claude-issue-20`.
**Data:** 2026-07-25.
**Nenhum comando abaixo tocou o Supabase remoto.**

## 1. `supabase start` aplica as 4 migrations existentes sem erro

```
Applying migration 0001_jobapp_schema.sql...
Applying migration 0002_marco5_assinatura.sql...
Applying migration 0003_push_subscriptions.sql...
Applying migration 0004_baseline_correcao.sql...
NOTICE (42P07): relation "push_subscriptions" already exists, skipping
Started supabase local development setup.
```

O `NOTICE` é o próprio `0004_baseline_correcao.sql` sendo idempotente (usa
`create table if not exists`) — não é erro.

## 2. Achado durante a montagem do harness: grants ausentes nas migrations

Ao rodar o primeiro teste contra o banco local recém-criado, o insert como
usuário autenticado falhou com `permission denied for table jobs` — não é
falha de RLS, é ausência de `GRANT` para os roles `anon`/`authenticated`.

Nenhuma das quatro migrations (`0001`–`0004`) tem uma instrução `GRANT`
explícita; elas sempre dependeram do comportamento legado do Supabase de
auto-expor toda tabela nova de `public` para esses roles. O CLI atual
(`supabase` `2.109.1`) já mudou esse default — `supabase/config.toml` gerado
por `supabase init` documenta isso:

```
# Controls whether new tables, views, sequences and functions created in the `public` schema by
# `postgres` are reachable through the Data API roles (`anon`, `authenticated`, `service_role`)
# without explicit GRANTs. When unset, new entities are NOT auto-exposed, matching the new cloud
# default. Set to `true` to keep the legacy behaviour of auto-exposing new entities; this is
# deprecated and the field is removed on 2026-10-30 once the always-revoked behaviour is permanent.
```

Como correção local (não uma migration nova — nenhum arquivo em
`supabase/migrations/` foi tocado), `auto_expose_new_tables = true` foi
habilitado em `supabase/config.toml` para reproduzir o comportamento que o
schema versionado assume. Isso é suficiente para este ticket (harness local
funcionando), mas é um risco real fora do escopo de `RD-17` para corrigir:

- **A flag é removida em 2026-10-30.** Depois disso, nenhuma quantidade de
  configuração de CLI recupera o comportamento legado — as migrations
  precisarão de `GRANT` explícito por tabela/role para continuar funcionando
  em qualquer Supabase local recriado após essa data.
- **Não se sabe se o projeto remoto de produção já foi migrado para o novo
  default** ou se está "grandfathered" com os grants legados aplicados
  manualmente quando as tabelas foram criadas — isso exige auditoria remota
  (mesmo tipo de trabalho que `RD-000` já fez para schema/RLS, mas para
  `information_schema.role_table_grants`), não coberta aqui.
- Recomendação: abrir um ticket específico (sugestão: `RD-00b` ou item novo
  antes de `2026-10-30`) para auditar grants remotos e, se confirmado que
  faltam, adicionar `GRANT` explícito nas migrations existentes — mesmo
  padrão de cautela usado em `RD-000`/`RD-00` (auditar antes de escrever a
  migration de correção).

## 3. Suíte de teste rodando localmente

```
$ npm test

> projetoapp@0.1.0 test
> vitest run

 RUN  v4.1.10 C:/Users/miguel/JobApp-Claude-Auto/issue-20

 ✓ tests/rede/rls/jobs.rls.test.ts > RLS: jobs (owner full access) > lets the owner read their own job 16ms
 ✓ tests/rede/rls/jobs.rls.test.ts > RLS: jobs (owner full access) > hides the job from a different authenticated user 28ms
 ✓ tests/rede/rls/jobs.rls.test.ts > RLS: jobs (owner full access) > rejects a different user trying to update the job 15ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Isso prova o critério de aceite de `RD-17` ponto a ponto:

1. **2+ usuários de teste criados** — `createTestUser()` chamado duas vezes
   (`userA`, `userB`) via `auth.admin.createUser` (service role).
2. **Autenticado como cada um** — cada `TestUser` carrega um client já
   logado (`authenticatedClient(email, password)` via
   `signInWithPassword`), sessão real sujeita a RLS.
3. **Asserção de RLS de ponta a ponta:**
   - dono lê a própria linha (`toHaveLength(1)`);
   - outro usuário autenticado não vê a linha (`toHaveLength(0)`, sem erro —
     RLS filtra, não bloqueia com erro);
   - outro usuário não consegue atualizar a linha (zero linhas afetadas).
4. **Ambiente que não é produção** — `tests/rede/support/env.ts` recusa
   rodar contra o host de produção mesmo que a variável aponte para lá (ver
   seção 4).

## 4. Guardrail de produção testado deliberadamente

Rodando a suíte com `SUPABASE_TEST_URL` apontado manualmente para o projeto
de produção (`seciereacfestemdhzhp.supabase.co`), sem nenhuma chamada de rede
real acontecer — o guard barra antes de qualquer client ser criado:

```
Error: [tests/rede] Refusing to run: SUPABASE_TEST_URL points at the production project
(seciereacfestemdhzhp.supabase.co). These tests create/delete users and must only run against a
local Supabase (supabase start) or a dedicated staging project.
```

## 5. Limpeza

`supabase stop` rodado ao final; nenhum container ficou de pé. `.env.test.local`
é gitignored (`.gitignore` raiz, regra `.env*`) e não foi commitado.
