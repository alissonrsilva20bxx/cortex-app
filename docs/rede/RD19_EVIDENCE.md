# RD-19 — Evidência

**Data:** 2026-07-28
**Ambiente:** worktree `agente-testes-worktree`, branch `agent/codex-rd19`, criada a partir de `agent/claude-backend-foundation` @ `c69c67a`.
**Produção/remoto:** não acessados. Nenhuma migration foi aplicada em nenhum ambiente remoto.

## 1. Escopo coberto nesta rodada

RD-19 pede testes de concorrência para quatro pontos sensíveis a corrida:
convites, amizades, curtidas e conversa 1:1. Três dos quatro têm suas
dependências (RD-04, RD-05, RD-13) já mescladas em `agent/claude-backend-foundation`
e foram implementados:

- `tests/rede/concurrency/amizades.concurrency.test.ts` — dispara
  `enviarPedidoAmizade` nos dois sentidos ao mesmo tempo (3 pares
  simultâneos) e prova que sobra exatamente uma linha `aceita` por par.
- `tests/rede/concurrency/curtidas.concurrency.test.ts` — dispara
  `alternarCurtida` em paralelo (5x pelo mesmo usuário; depois 4 usuários
  distintos ao mesmo tempo) e prova que a PK composta
  `(post_id, user_id)` nunca é violada nem duplicada.
- `tests/rede/concurrency/conversas.concurrency.test.ts` — dispara
  `abrirConversa1a1` simultaneamente dos dois lados (6 chamadas por par;
  depois 3 pares independentes de uma vez) através da camada de serviço
  `lib/rede/mensagens.ts`, e prova que só uma linha em `rede_conversas`
  sobrevive por par ordenado.

## 2. Cenário bloqueado: resgate simultâneo de convite (RD-15)

RD-19 depende explicitamente de RD-15 (`app/api/rede/convites/route.ts` +
RPC de resgate atômico). No momento em que os três testes acima foram
escritos, `agent/claude-backend-foundation` (a base desta branch) não
continha esse endpoint nem a migration da RPC — só existia como trabalho
**não commitado** de outro agente num worktree paralelo
(`rd-15-review-worktree`, pertencente a outro usuário do SO/sandbox).

**Atualização:** confirmamos por `gh api repos/.../branches` que RD-15 foi
publicada no GitHub como `origin/agent/claude-backend-rd15`
(commit `27e3890`), divergindo de `agent/claude-backend-foundation` em
`ccab982` — ou seja, antes do commit `c69c67a` ("fix(rede): make LiveLink
reorder atomic") que é o HEAD usado como base desta branch. Essa branch
ainda **não foi mesclada** em `agent/claude-backend-foundation` nem nesta
branch (`agent/codex-rd19`).

O quarto teste de concorrência (resgate simultâneo do mesmo código de
convite via `rede_resgatar_convite`) fica para um commit seguinte, depois
que `agent/claude-backend-rd15` for integrada a esta branch — decisão
deliberada para não trazer o código de outro agente para dentro deste PR
sem que isso seja pedido explicitamente.

## 3. Qualidade estática — executada e verde

```
$ npx tsc --noEmit
(sem saída, exit 0)

$ npx eslint tests/rede/concurrency --ext .ts
(sem saída, exit 0)
```

Cobre os três arquivos novos de `tests/rede/concurrency/`.

## 4. Execução contra Postgres real — pendente

`npm test` desta suíte precisa de um Supabase local (`supabase start`,
via Docker) — ver `docs/rede/TEST_HARNESS.md`. Nesta sessão, o Docker
Desktop (Windows) travou na inicialização: `docker info` não retornou
mesmo após múltiplas tentativas com timeout estendido (a mais longa,
100s, ainda expirou). Os containers do Docker Desktop apareciam no
Gerenciador de Tarefas, mas o daemon não respondia ao socket.

**Não foi possível gerar evidência de execução real (`npm test`) nesta
rodada.** Os três arquivos foram revisados manualmente linha a linha
contra os schemas/constraints reais (`supabase/migrations/0008`, `0009`,
`0010`) e contra os testes de RLS irmãos já verdes
(`tests/rede/rls/social-graph.rls.test.ts`,
`tests/rede/rls/rede_conteudo.rls.test.ts`,
`tests/rede/rls/messaging.rls.test.ts`), reaproveitando exatamente os
mesmos helpers de seed de membership e os mesmos padrões de asserção.

**Próximo passo:** depois que o Docker Desktop for reiniciado,
`npm run supabase:start && npm test` — este documento deve ser atualizado
com a saída real antes de RD-19 ser considerado concluído. Até lá, este
PR deve ser tratado como **rascunho** (typecheck/lint verdes, execução
real pendente).

## 5. O que este ticket ainda não faz

- Não cobre o cenário de convites (bloqueado — ver seção 2).
- Não roda em CI (mesma limitação já registrada em `TEST_HARNESS.md` para
  `RD-18`).
- Não aplica nem toca nenhuma migration nova — reutiliza integralmente o
  schema já mesclado em `agent/claude-backend-foundation`.
