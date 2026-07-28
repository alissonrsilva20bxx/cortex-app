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

## 3. Execução — status: **pendente, Docker local sem resposta**

Tentei três vezes (`docker ps`, `docker exec ... pg_isready`) contra o mesmo stack Docker compartilhado (`supabase_db_cortex-app`) documentado como ponto de atenção em `RD02_EVIDENCE.md` §3 — todas as tentativas deram timeout (60s+) sem resposta do daemon. Consistente com o mesmo achado operacional já registrado: o stack é compartilhado entre worktrees/agentes, e pode estar ocupado com `supabase stop`/`start`/`db reset` de outro trabalho em paralelo (RD-19/RD-20, rodando por outro agente no mesmo período).

**Não apliquei a migration nem rodei o teste ainda.** Migration e teste estão escritos e prontos; a validação `supabase db reset && npm test` fica pendente da primeira janela em que o stack local responder. Vou tentar novamente ao longo da sessão sem bloquear o restante do trabalho (RD-05b, RD-08).

## 4. O que ainda falta para fechar este ticket

- Rodar `npm run supabase:status` para confirmar o stack está de pé.
- Rodar `supabase db reset` (ou `supabase start`, se os containers tiverem caído) para aplicar `0007` do zero junto com tudo que já existe.
- Copiar URL/anon key/service_role key para `.env.test.local` (gitignored) se ainda não existir neste worktree.
- Rodar `npm test -- rede_assinaturas` e colar a saída aqui.
