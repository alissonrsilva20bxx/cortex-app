# RD-03 — Evidência de execução

**Ambiente:** worktree `C:\Users\miguel\JobApp-Claude-RD03`, branch `agent/claude-backend-rd03` (base: `origin/agent/codex-rd10-review`, o branch pushado mais completo — migrations 0001–0006/0008–0012, services `lib/rede/*`, suíte `tests/rede/**`).
**Data:** 2026-07-28.
**Nenhum comando abaixo tocou o Supabase remoto.** Nenhum merge/push foi feito.

## 1. `supabase/migrations/0007_rede_assinaturas.sql`

Cria `rede_assinaturas` com o bloqueador crítico do `CODEX_REVIEW.md` corrigido desde a primeira versão (não é um retrofit — a tabela nasce já com a RLS certa):

- `user_id` (PK/FK `auth.users`), `status` (`rede_assinatura_status`: trial/ativa/vencida/cancelada — enum próprio, não reaproveita `assinatura_status` de `configuracoes`, que só tem 3 valores), `trial_started_at`, `criado_em`. Shape idêntico ao proposto em `BETA_DOMAIN_MODEL.md` §9.
- **Defesa em duas camadas independentes**, cada uma suficiente sozinha:
  1. `GRANT` de tabela: `authenticated` recebe só `SELECT`. Nenhum `INSERT`/`UPDATE`/`DELETE` é concedido a esse role — a escrita falha na checagem de privilégio do Postgres, antes de qualquer policy de RLS ser avaliada.
  2. RLS: só existe uma policy, `"rede_assinaturas: owner select"` (`SELECT`, `using (auth.uid() = user_id)`). Nenhuma policy de escrita para `authenticated` — RLS nega por padrão quando nenhuma policy cobre o comando.
- `service_role` recebe `SELECT, INSERT, UPDATE, DELETE` via `GRANT` (e ignora RLS por padrão no Supabase — `bypassrls`), preservando o caminho privilegiado para webhook de pagamento/rotina admin, conforme `BETA_DOMAIN_MODEL.md` §9.

## 2. `tests/rede/rls/rede_assinaturas.rls.test.ts`

Sete casos, provando especificamente o critério de aceite do ticket ("teste automatizado que prove que um cliente autenticado não consegue autoativar ou prorrogar o plano"):

- Dono lê a própria linha (`status: "trial"`).
- Terceiro não vê a linha do dono (RLS filtra, sem erro).
- Insert direto do próprio usuário é bloqueado (erro).
- **Update para `status: "ativa"` pelo próprio dono é bloqueado (erro)** — a asserção central deste ticket.
- Update de `trial_started_at` pelo próprio dono é bloqueado (erro) — cobre a segunda forma de abuso citada em `BETA_DOMAIN_MODEL.md` §9 ("reiniciar trial").
- Delete pelo próprio dono é bloqueado (erro).
- `service_role` ainda consegue gerenciar a linha normalmente — prova que a restrição é específica de `authenticated`, não uma trava geral que quebraria o caminho administrativo.

## 3. Execução — status: **validado, 2026-07-28**

Docker Desktop precisou ser reiniciado manualmente nesta sessão (daemon não respondia nem a `docker ps`, não só a comandos dentro do container — travamento do daemon, não contenção de Postgres). Depois do restart, `supabase db reset` aplicou `0001`–`0012` (incluindo `0007_rede_assinaturas.sql`) sem erro. `node_modules` estava ausente neste worktree (nunca instalado); rodei `npm install` antes de tudo.

```
$ npm test -- rede_assinaturas

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  2.59s
```

Os 7 casos passaram, incluindo a asserção central (`update status: "ativa"` pelo próprio dono bloqueado).

## 4. Fechamento

- [x] `npm run supabase:status` confirmado.
- [x] `supabase db reset` aplicado.
- [x] `.env.test.local` criado (gitignored, chaves padrão de dev local do Supabase).
- [x] `npm test -- rede_assinaturas`: 7/7 passando.
