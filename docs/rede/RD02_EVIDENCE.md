# RD-02 — Evidência de execução

**Ambiente:** Supabase local (`supabase start`/`db reset`, Docker), worktree
`agent/claude-issue-4`.
**Data:** 2026-07-25.
**Nenhum comando abaixo tocou o Supabase remoto.** Nenhum merge/push foi feito.

## 1. `supabase/migrations/0006_rede_perfis.sql`

Cria `rede_perfis` e `rede_livelinks` com RLS na mesma migration (regra do
projeto — nunca tabela sem RLS numa migration separada):

- `rede_perfis`: 1:1 com `auth.users`, opt-in explícito (existir na tabela =
  ter entrado na Rede, mesmo princípio de `push_subscriptions`).
- `rede_livelinks`: FK para `rede_perfis(user_id)` (não direto para
  `auth.users`), com índice `(user_id, ordem)` para o caso de uso de
  reordenar.
- `public.rede_is_member()`: função `security definer`, `search_path` fixo,
  mesmo padrão de `public.rede_is_admin()` (0005) — evita repetir a subquery
  em `rede_convites` em cada policy e centraliza a checagem "tem convite
  resgatado" para reuso pelas próximas migrations da Rede (posts,
  mensagens, etc., conforme `SUPABASE_MIGRATION_PLAN.md` §2).
- Grants explícitos por tabela/role (não depende do auto-expose legado do
  Supabase, já desligado neste projeto — ver achado do `RD-17`).

Aplicada com sucesso via `supabase db reset` contra um Postgres local
descartável, sem erros (só `NOTICE`s esperados de idempotência):

```
Applying migration 0005_rede_beta_gating.sql...
Applying migration 0006_rede_perfis.sql...
NOTICE (00000): trigger "rede_perfis_updated_at" for relation "public.rede_perfis" does not exist, skipping
```

## 2. Suíte de teste (`tests/rede/rls/rede_perfis.rls.test.ts`)

Estende o harness do `RD-17` (`tests/rede/support/`) com um novo arquivo de
teste cobrindo o critério de aceite do `RD-02` ponto a ponto — 3 usuários
de teste descartáveis (dois com convite resgatado simulado via
`adminClient` gravando direto em `rede_convites`, um sem convite):

```
$ npm test

> projetoapp@0.1.0 test
> vitest run

 Test Files  2 passed (2)
      Tests  12 passed (12)
```

Cobertura:

- **Insert sem convite resgatado é rejeitado** — `outsider` tenta inserir em
  `rede_perfis`, a policy `rede_perfis: owner insert requires invite`
  rejeita via `WITH CHECK` (erro, não filtragem silenciosa).
- **Insert com convite resgatado funciona** — `memberA` cria a própria
  linha com sucesso.
- **Qualquer membro lê o perfil de outro membro** — `memberB` (convite
  resgatado, não é dono) faz `SELECT` no perfil de `memberA` e recebe a
  linha.
- **Não-membro não lê perfil de terceiro** — `outsider` faz o mesmo
  `SELECT` e recebe lista vazia (RLS filtra, sem erro).
- **Outro membro não consegue atualizar perfil alheio** — `memberB` tenta
  `UPDATE` no perfil de `memberA`, zero linhas afetadas.
- Mesmo conjunto de asserções para `rede_livelinks`: dono cria, outro
  membro lê, não-membro não lê, outro membro não consegue atualizar o
  LiveLink alheio.

## 3. Achado operacional (não é bug da migration)

Durante a execução, o stack local do Supabase (containers Docker,
`project_id = cortex-app` em `supabase/config.toml`) foi derrubado
externamente enquanto `npm install` rodava — provavelmente por ser
compartilhado entre worktrees do mesmo projeto (mesmo `project_id` local
para todas as branches `agent/claude-issue-*`). Isso causou uma falha
inicial (`ECONNREFUSED` / `Could not find the table 'public.rede_livelinks'
in the schema cache`) que não tinha relação com a migration — confirmado
reiniciando o stack (`supabase start` recriou os containers do zero,
reaplicando todas as migrations) e vendo a suíte passar 12/12 na sequência.
Registrado aqui só como nota operacional para quem for rodar `RD-18` depois:
rodar `supabase status` antes de depender do stack estar de pé, já que ele
é compartilhado entre worktrees.

## 4. Nota sobre tipos TS

`tsc --noEmit` (rodado pelo hook de pre-commit) falha se o teste chamar
`rede_perfis`/`rede_livelinks`/`rede_convites` através do client tipado —
essas tabelas ainda não existem em `lib/database.types.ts`, porque
regenerá-lo é o próprio `RD-09`, que só roda depois que todas as migrations
MVP estiverem aplicadas (não é este ticket, e `lib/database.types.ts` não
é editado à mão, conforme a nota de atenção do `RD-09` em
`BACKEND_TICKETS.md`). O teste deste ticket usa uma view não-tipada do
mesmo client (`untyped()` em `rede_perfis.rls.test.ts`) só para essas
tabelas novas — volta a ser tipado automaticamente assim que `RD-09` rodar.

## 5. Limpeza

`supabase stop` rodado ao final; nenhum container ficou de pé.
`.env.test.local` é gitignored (`.env*` no `.gitignore` raiz) e não foi
commitado.
