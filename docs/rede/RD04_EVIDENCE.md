# RD-04 — Evidência de execução

**Ambiente:** Supabase local (`supabase start`/`db reset`, Docker), worktree
`agent/claude-issue-6`.
**Data:** 2026-07-26.
**Nenhum comando abaixo tocou o Supabase remoto.** Nenhum merge/push foi feito.

## 1. `supabase/migrations/0008_rede_social_graph.sql`

Cria `rede_amizades` e `rede_bloqueios` com RLS na mesma migration (regra do
projeto — nunca tabela sem RLS numa migration separada):

- `rede_amizades`: FK de `solicitante_id`/`destinatario_id` para
  `rede_perfis(user_id)` (não direto para `auth.users`), mesmo padrão de
  `rede_livelinks` (0006) — só quem já tem perfil (convite resgatado)
  aparece nos dois lados. Índice único sobre o par não-ordenado
  (`least`/`greatest` dos dois ids) garante que um pedido duplicado, em
  qualquer sentido, é rejeitado pelo banco — não é checagem de aplicação.
  `CHECK (solicitante_id <> destinatario_id)` impede autoamizade.
- `rede_bloqueios`: mesma FK para `rede_perfis(user_id)`,
  `UNIQUE(bloqueador_id, bloqueado_id)` e `CHECK` contra autobloqueio. RLS
  restringe toda visibilidade/gerência ao próprio `bloqueador_id` — o
  bloqueado não tem policy nenhuma que exponha a linha (intencional, ver
  `BETA_DOMAIN_MODEL.md` §6).
- Grants explícitos por tabela/role, mesmo padrão de 0005/0006 (sem
  depender do auto-expose legado do Supabase).

Aplicada com sucesso via `supabase db reset` contra um Postgres local
descartável, sem erros:

```
Applying migration 0005_rede_beta_gating.sql...
Applying migration 0006_rede_perfis.sql...
NOTICE (00000): trigger "rede_perfis_updated_at" for relation "public.rede_perfis" does not exist, skipping
Applying migration 0008_rede_social_graph.sql...
```

## 2. Suíte de teste (`tests/rede/rls/rede_social_graph.rls.test.ts`)

Estende o harness do `RD-17` (`tests/rede/support/`), 3 usuários de teste
descartáveis, cada um com perfil (`rede_perfis`) seedado via `adminClient`:

```
$ npx vitest run tests/rede/rls/rede_social_graph.rls.test.ts

 Test Files  1 passed (1)
      Tests  20 passed (20)
```

Suíte completa do projeto (regressão, inclui os 3 arquivos de teste
pré-existentes):

```
$ npm test

 Test Files  4 passed (4)
      Tests  48 passed (48)
```

Cobertura, ponto a ponto contra os critérios de aceite do ticket:

- **Pedido de amizade duplicado no mesmo sentido é rejeitado** — segundo
  `INSERT` de A→B falha (índice único).
- **Pedido de amizade duplicado no sentido inverso é rejeitado** — B→A
  falha depois que A→B já existe (prova que o índice é sobre o par
  não-ordenado, não só `(solicitante_id, destinatario_id)` literal).
- **Autoamizade é rejeitada** — `CHECK` barra `solicitante_id =
destinatario_id`.
- **Impersonar outro usuário como solicitante é rejeitado** — `memberC`
  tenta inserir uma linha com `solicitante_id = memberA.id`, `WITH CHECK`
  barra.
- **Só as duas pontas veem a linha** — destinatário lê o pedido pendente;
  um terceiro membro não vê nada (lista vazia, sem erro).
- **Qualquer uma das pontas gerencia a linha** — destinatário aceita
  (`UPDATE status`), um terceiro não consegue nem `UPDATE` nem `DELETE`
  (zero linhas afetadas), qualquer uma das pontas consegue `DELETE`.
- **Depois de apagada, o par pode pedir de novo** — confirma que o índice
  único é sobre linhas existentes, não um bloqueio permanente do par.
- **Bloqueio: dono cria, vê e remove; duplicata do mesmo par é rejeitada;
  autobloqueio é rejeitado; impersonar outro usuário como bloqueador é
  rejeitado.**
- **Bloqueado não descobre que foi bloqueado** — `SELECT` do lado
  bloqueado devolve lista vazia, sem erro (RLS filtra silenciosamente, não
  é um `403`).
- **Terceiro não-relacionado também não vê o bloqueio de outra dupla.**

## 3. Typecheck

`npx tsc --noEmit` roda limpo (sem erros) — o novo teste usa a mesma
`untyped()` view do client que `rede_perfis.rls.test.ts`, pelo mesmo motivo
documentado em `RD02_EVIDENCE.md` §4 (`rede_amizades`/`rede_bloqueios`
ainda não existem em `lib/database.types.ts`; regenerar é `RD-09`).

## 4. Limpeza

`supabase stop` rodado ao final; nenhum container ficou de pé.
`.env.test.local` é gitignored (`.env*` no `.gitignore` raiz) e não foi
commitado.
