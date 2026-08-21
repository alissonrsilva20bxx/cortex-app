# RD-17 — Harness de testes local/staging

**Status:** implementado, aguardando revisão do Codex. Nenhuma migration remota foi aplicada, nenhum merge/deploy foi feito.

## 1. O que este ticket entrega

Infraestrutura mínima para rodar testes de RLS/concorrência contra um Supabase local descartável:

- `supabase/config.toml` (via `supabase init`) — permite `supabase start` rodar um Postgres+Auth+Storage local via Docker, aplicando `supabase/migrations/*.sql` automaticamente a cada start.
- Ferramenta de teste escolhida: **Vitest** (`vitest.config.ts`). Não havia suíte automatizada no projeto antes deste ticket (confirmado em `CURRENT_BACKEND_AUDIT.md`) — Vitest foi escolhido por rodar TypeScript nativamente sem passo de build separado, ter execução rápida o suficiente para testes de concorrência, e não exigir infraestrutura própria de servidor (diferente de Playwright/Cypress, que seriam overkill para testes que só falam HTTP com o Supabase, não com o navegador).
- `tests/rede/support/` — camada reutilizável:
  - `env.ts` — lê `SUPABASE_TEST_URL`/`SUPABASE_TEST_ANON_KEY`/`SUPABASE_TEST_SERVICE_ROLE_KEY` e **recusa qualquer host que não seja `localhost` ou `127.0.0.1`**.
  - `clients.ts` — `adminClient()` (service role, só para setup/teardown), `anonClient()`, `authenticatedClient(email, password)`.
  - `testUsers.ts` — `createTestUser()`/`deleteTestUser()`: cria usuário descartável via `auth.admin.createUser` (email/senha, pré-confirmado) e devolve um client já autenticado como esse usuário. O app em produção só usa Google OAuth (`docs/adr/0001`); o harness usa email/senha via admin API porque é a forma de obter uma sessão real sem navegador — não altera nem participa do fluxo de login do app.
  - `vitest.setup.ts` — carrega `.env.test.local` (gitignored, já coberto pela regra `.env*` do `.gitignore` raiz).
- `tests/rede/rls/jobs.rls.test.ts` — teste de ponta a ponta provando o critério de aceite.

## 2. Por que o teste usa a tabela `jobs`, não uma tabela da Rede

Nenhuma tabela da Rede existe ainda — `RD-01` (a primeira migration da Rede) ainda não foi implementada. `RD-17` depende só de `RD-000`, não de `RD-01`, então este ticket não pode esperar por uma tabela da Rede para provar que o harness funciona.

`jobs` já existe desde `0001_jobapp_schema.sql` com a policy `"jobs: owner full access"` (`using (auth.uid() = user_id)`), o mesmo padrão de RLS por dono que toda tabela da Rede vai usar. O teste prova exatamente o que o critério de aceite pede — criar 2+ usuários, autenticar como cada um, rodar uma asserção de RLS de ponta a ponta — contra uma tabela real, sem precisar simular nada. `RD-18` reaproveita este mesmo `tests/rede/support/` para as tabelas da Rede assim que `RD-01`+ existirem.

## 3. Como rodar

### Local (recomendado para desenvolvimento)

```bash
npm run supabase:start      # sobe Postgres/Auth/Storage local via Docker, aplica supabase/migrations/*.sql
npm run supabase:status     # imprime API URL, anon key, service_role key
```

Copiar os três valores para `.env.test.local` (gitignored) na raiz do projeto:

```
SUPABASE_TEST_URL=http://127.0.0.1:54321
SUPABASE_TEST_ANON_KEY=<anon key impressa por supabase:status>
SUPABASE_TEST_SERVICE_ROLE_KEY=<service_role key impressa por supabase:status>
```

```bash
npm test                    # roda a suíte uma vez
npm run test:watch          # modo watch
npm run supabase:stop       # derruba os containers quando terminar
```

## 4. Evidência de que o critério de aceite foi cumprido

Ver `docs/rede/TEST_HARNESS_EVIDENCE.md` — saída real de `supabase start` + `npm test` rodados neste worktree contra o Supabase local, provando: 2 usuários de teste criados, autenticados individualmente, e as três asserções de RLS (owner lê, terceiro não lê, terceiro não escreve) passando.

## 6. Checklist de aprovação humana para correções de segurança/RLS

Issue #49 — a revisão independente do PR #47 (fix de segurança/RLS) aprovou o merge só com base na descrição do PR e no build passando, sem reexecutar `npm test` (evitou perturbar uma instância local do Supabase aparentemente em uso concorrente por outra sessão). Para qualquer correção de segurança/RLS futura, o passo abaixo é obrigatório antes de aprovar o merge, não opcional:

1. Confirmar que nenhuma outra sessão está usando o Supabase local no momento (`npx supabase status` — se algo já estiver rodando e for de outra sessão ativa, subir uma instância descartável separada em vez de derrubar a existente).
2. Rodar `npm test` (`vitest run`) localmente contra esse Supabase, não só confiar na descrição do autor do PR.
3. Registrar o resultado (N/M passando, quais falhas são as 2 pré-existentes conhecidas — `tests/wiring/cofre-visual.test.ts` #58, `tests/rede/concurrency/curtidas.concurrency.test.ts` #60 — vs. algo novo) no comentário de aprovação.

Baseline atual (2026-08-21, `origin/mockuptesterede` @ `6ab716a`): **571/573 passando**, as 2 falhas são exatamente as pré-existentes acima — nenhuma regressão nova.

## 7. O que este ticket não faz

- Não escreve testes para tabelas da Rede (isso é `RD-18`).
- Não escreve testes de concorrência (isso é `RD-19`).
- Não aplica nenhuma migration no Supabase remoto, não faz merge, não faz deploy.
- Não decide CI (`RD-18` critério de aceite menciona "roda em CI ou pelo menos localmente de forma repetível" — este ticket entrega o "localmente de forma repetível"; conectar a um workflow de CI fica para quando `RD-18` justificar o custo de manter um Supabase local dentro do CI).
