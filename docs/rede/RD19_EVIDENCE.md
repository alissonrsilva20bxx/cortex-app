# RD-19 — Evidência

**Data:** 2026-07-28
**Ambiente:** worktree `agente-testes-worktree`, branch `agent/codex-rd19`, criada a partir de `agent/claude-backend-foundation` @ `c69c67a`.
**Produção/remoto:** não acessados. Nenhuma migration foi aplicada em nenhum ambiente remoto.

## 1. Escopo coberto

RD-19 pede testes de concorrência para quatro pontos sensíveis a corrida:
convites, amizades, curtidas e conversa 1:1. Os quatro estão cobertos:

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
- `tests/rede/concurrency/convites.concurrency.test.ts` — dispara
  `rede_resgatar_convite` de dois usuários diferentes ao mesmo tempo pelo
  mesmo código (3 trials), mais um teste isolado de resgate solo e um de
  resgate contra código já usado; prova que exatamente um resgate vence
  (`status: 'resgatado'`), o outro recebe `'invalido'`, e `usado_por`
  nunca fica ambíguo.

## 2. Cenário de convites — como foi desbloqueado

RD-19 depende explicitamente de RD-15 (`app/api/rede/convites/route.ts` +
RPC de resgate atômico). Quando os três primeiros testes acima foram
escritos, `agent/claude-backend-foundation` (a base original desta
branch) não continha esse endpoint nem a migration da RPC — só existia
como trabalho **não commitado** de outro agente num worktree paralelo
(`rd-15-review-worktree`, pertencente a outro usuário do SO/sandbox), que
foi deliberadamente ignorado.

Em seguida, confirmamos por `gh api repos/.../branches` que uma versão
diferente e já commitada de RD-15 tinha sido publicada no GitHub como
`origin/agent/claude-backend-rd15` (commit `27e3890`). Essa branch
diverge de `agent/claude-backend-foundation` em `ccab982` — antes do
commit `c69c67a` ("fix(rede): make LiveLink reorder atomic") usado como
base desta branch — mas o `git diff --stat` entre as duas não mostrou
nenhum arquivo em comum além de `lib/database.types.ts`, então o merge
foi seguro.

**Ação tomada (autorizada explicitamente antes de prosseguir):**
`git merge origin/agent/claude-backend-rd15` nesta branch
(`agent/codex-rd19`). Único conflito: `lib/database.types.ts`, resolvido
mantendo as duas entradas de função (`rede_gerar_convite`, já presente, e
`rede_resgatar_convite`, trazida pelo merge) — sem perda de tipos de
nenhum dos dois lados. `npx tsc --noEmit` e `npx eslint` confirmam que o
merge não quebrou nada.

A RPC relevante (`supabase/migrations/0015_rede_convites_rpc.sql`) resolve
a corrida com um único `UPDATE ... WHERE usado_por IS NULL AND
expira_em > now() RETURNING` — a segunda transação concorrente espera o
lock de linha da primeira e, ao continuar, seu `WHERE` não casa mais.

## 3. Qualidade estática — executada e verde

```
$ npx tsc --noEmit
(sem saída, exit 0)

$ npx eslint tests/rede/concurrency app/api/rede/convites --ext .ts
(sem saída, exit 0)
```

Cobre os quatro arquivos de `tests/rede/concurrency/` e o endpoint
`app/api/rede/convites/route.ts` trazido pelo merge de RD-15.

## 4. Execução contra Postgres real — pendente

`npm test` desta suíte precisa de um Supabase local (`supabase start`,
via Docker) — ver `docs/rede/TEST_HARNESS.md`. Nesta sessão, o Docker
Desktop (Windows) travou na inicialização: `docker info` não retornou
mesmo após múltiplas tentativas com timeout estendido (a mais longa,
100s, ainda expirou). Os containers do Docker Desktop apareciam no
Gerenciador de Tarefas, mas o daemon não respondia ao socket.

**Não foi possível gerar evidência de execução real (`npm test`) nesta
rodada.** Os quatro arquivos foram revisados manualmente linha a linha
contra os schemas/constraints/RPCs reais (`supabase/migrations/0008`,
`0009`, `0010`, `0015`) e contra os testes de RLS irmãos já verdes
(`tests/rede/rls/social-graph.rls.test.ts`,
`tests/rede/rls/rede_conteudo.rls.test.ts`,
`tests/rede/rls/messaging.rls.test.ts`,
`tests/rede/rls/beta-gating.rls.test.ts`), reaproveitando exatamente os
mesmos helpers de seed de membership/convite e os mesmos padrões de
asserção.

**Próximo passo:** depois que o Docker Desktop for reiniciado,
`npm run supabase:start && npm test` — este documento deve ser atualizado
com a saída real antes de RD-19 ser considerado concluído. Até lá, este
PR deve ser tratado como **rascunho** (typecheck/lint verdes, execução
real pendente).

## 5. O que este ticket ainda não faz

- Não roda em CI (mesma limitação já registrada em `TEST_HARNESS.md` para
  `RD-18`).
- Não aplica nem toca nenhuma migration nova — reutiliza integralmente o
  schema já mesclado em `agent/claude-backend-foundation`.

## 6. Atualização 2026-08-05 — causa raiz confirmada do teste instável

Rodando esta suíte contra Postgres real local (`supabase db reset` +
`npm test`), o teste `keeps exactly one like row when the same user
toggles the same post in parallel`
(`tests/rede/concurrency/curtidas.concurrency.test.ts`) falha de forma
intermitente: em ~10 execuções isoladas, falhou 2 vezes com
`contarCurtidas` retornando `0` em vez de `1`. Nunca falhou com `rejected`
(a asserção `expect(rejected).toHaveLength(0)` nunca quebrou) e nunca
produziu mais de uma linha — só o valor final oscila entre `0` e `1`.

**Não é flakiness de infraestrutura de teste.** É uma condição de corrida
real em `lib/rede/feed.ts#alternarCurtida` (linhas ~298–338): a função lê
o estado atual (`SELECT ... maybeSingle()`) e só depois decide inserir ou
apagar — leitura e escrita são duas chamadas HTTP separadas ao PostgREST,
cada uma sua própria transação implícita, sem lock nem transação única
cobrindo as duas. O comentário original do teste ("quem segura a corrida
é a PK composta... combinada com upsert `ignoreDuplicates`") descreve
metade da proteção real: a PK composta `(post_id, user_id)` garante que
nunca sobra mais de uma linha nem duas escritas conflitantes erram — mas
não garante _qual_ será o estado final quando 5 chamadas do mesmo usuário
disparam em paralelo a partir de "não curtido". Se uma leitura de uma
chamada posterior acontece depois que outra já commitou seu insert, essa
chamada decide apagar; dependendo de quantas chamadas leem o estado antes
vs. depois de escritas concorrentes, o número líquido de inserts vs.
deletes pode fechar em 0 ou em 1 — ambos são resultados válidos do
código atual, não um bug no teste.

**Efeito em produção:** sem crash, sem duplicidade, sem corrupção de
dados nem vazamento entre usuárias — o pior caso é uma usuária que
clica/toca "curtir" várias vezes muito rápido (ex.: duplo toque, retry de
rede) podendo terminar com o post no estado oposto ao que ela via na
tela no último toque. É um bug de UX/consistência menor, não um problema
de segurança ou isolamento.

**O que não foi feito nesta rodada, deliberadamente:** o código de
`alternarCurtida` não foi alterado (não fazia parte do escopo desta
revisão, que era limitado aos itens de segurança/integridade
explicitamente listados) e o teste não foi enfraquecido, marcado como
`skip` ou re-escrito para tolerar `0` — isso mascararia a causa real.
`RD-19` permanece com este teste conhecido como instável até que
`alternarCurtida` seja reescrito como uma operação atômica única (ex.:
uma função `SECURITY DEFINER` que decide e executa a troca de estado
dentro de uma única transação/lock de linha, no mesmo padrão já usado por
`rede_criar_conversa_1a1` e `rede_resgatar_convite`). Ticket de
acompanhamento sugerido: novo item em `BACKEND_TICKETS.md` referenciando
esta seção antes de `alternarCurtida` ser considerado seguro sob
concorrência real de UI (double-tap).
