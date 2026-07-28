# RD-15 — Evidência de execução

**Ambiente:** worktree `C:\Users\miguel\JobApp-Claude-RD15`, branch `agent/claude-backend-rd15` (base: `origin/agent/codex-rd10-review`).
**Data:** 2026-07-28.
**Nenhum comando abaixo tocou o Supabase remoto.** Nenhum merge/push foi feito.

## 0. Por que este ticket foi construído do zero, não editado

Uma tentativa anterior deste ticket já existia — mas só no sandbox local do Codex (`C:\Users\miguel\Documents\Codex\...\rd-15-review-worktree`), nunca pushada pro GitHub (`git ls-remote` confirmou: não existe `agent/codex-rd15` nem `-review` no origin). `docs/rede/CODEX_IMPLEMENTATION_AUDIT.md` §3 documentou um bug real nessa versão: a rota de resgate chamava a RPC com `{ codigo: <texto puro> }`, mas a função no banco só tem o parâmetro `codigo_hash` (e exige um SHA-256 já calculado, nunca o texto puro) — isso quebraria 100% dos resgates.

Em vez de editar os arquivos daquele worktree (workspace de outro agente, dono de conta Windows diferente, sem visibilidade de que outra coisa poderia estar em andamento lá), implementei esta versão do zero neste worktree próprio, reaproveitando o que a auditoria já validou como correto na versão anterior (rate limit persistido, resgate atômico, hash com entropia de 32 bytes) e corrigindo especificamente o que estava errado.

## 1. `supabase/migrations/0015_rede_convites_rpc.sql`

Numeração `0015` (`0014` já usado por `RD08_EVIDENCE.md` neste conjunto de branches).

- `private.rede_convite_rate_limits`: rate limit persistido no banco (não em memória — um `Map` em processo não sobrevive a reinício nem funciona entre instâncias serverless separadas, problema real da primeiríssima versão que existiu deste ticket).
- `rede_gerar_convite(codigo_hash text)`: só admin (`rede_is_admin()`), valida formato de hash (`^[0-9a-f]{64}$`), expira em 7 dias, nunca recebe texto puro.
- `rede_resgatar_convite(codigo_hash text, ip_hash text)`: rate limit de 5 tentativas/15 min por usuário **e** por IP (chave do usuário travada primeiro, não pode ser burlada trocando IP), resgate atômico via `UPDATE ... WHERE usado_por IS NULL AND expira_em > now() RETURNING`.
- Sem `GRANT` de `private.rede_convite_rate_limits` para `authenticated` — só as funções `SECURITY DEFINER` tocam essa tabela.

## 2. `app/api/rede/convites/route.ts`

- Gera o código com `crypto.randomBytes(32)` (256 bits), hasheia com SHA-256 antes de qualquer contato com o banco; o texto puro só existe na resposta HTTP pro admin.
- **A correção do bug:** `resgatarConvite` chama a RPC com `{ codigo_hash: hashCodigo(codigo), ip_hash: hashCodigo(obterIp(request)) }` — nome de parâmetro certo, valor hasheado. Comentário no código aponta explicitamente pra migration como referência do contrato.
- IP extraído de `x-forwarded-for`/`x-real-ip` no servidor (nunca confia em IP declarado pelo client).

## 3. `tests/rede/routes/convites.route.test.ts` — a lacuna que causou o bug, fechada

`CODEX_IMPLEMENTATION_AUDIT.md` §4 registrou que o motivo do bug não ter sido pego é não existir nenhum teste cobrindo a rota de convites. Este arquivo fecha essa lacuna com um teste mockado (não depende do Postgres — mocka `lib/supabase-server`, no mesmo padrão de `tests/rede/routes/solicitar-beta.route.test.ts`):

**13 casos, rodados e passando agora mesmo** (evidência abaixo):

- `gerar`: 401 sem sessão, sem chamar a RPC; sucesso com asserção exata de `rpc("rede_gerar_convite", { codigo_hash: <hash do código gerado> })`, garantindo que `codigo` nunca é enviado como parâmetro; 403 em `42501`; 500 sem vazar detalhe interno.
- `resgatar`: 401 sem sessão; 400 com código vazio, sem chamar a RPC; **a asserção que teria pego o bug real** — `rpc("rede_resgatar_convite", { codigo_hash: <hash>, ip_hash: <hash> })`, com `params` explicitamente **sem** a chave `codigo`; extração de IP via `x-real-ip` como fallback; 429 com `retry-after` no status `"limitado"`; 400 no status `"invalido"`; 500 sem vazar detalhe interno.
- Ação inválida → 400. JSON malformado → 400.

```
$ npx vitest run tests/rede/routes/convites.route.test.ts

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  916ms
```

## 4. `tsc --noEmit` — passou

Precisou de um ajuste real: `lib/database.types.ts` não tinha `rede_gerar_convite`/`rede_resgatar_convite` em `Functions` (as únicas duas RPCs novas deste ticket). Adicionadas seguindo o mesmo formato das entradas já existentes (`Args`/`Returns: Json`). Depois disso, `npx tsc --noEmit` roda limpo, zero erros.

## 5. Execução contra Postgres — status: **validado, 2026-07-28**

Docker Desktop foi reiniciado manualmente nesta sessão (daemon travado, mesmo achado de `RD03_EVIDENCE.md` §3). `supabase db reset` aplicou `0015_rede_convites_rpc.sql` sem erro. Reconfirmado `npm test -- convites`: 13/13 passando (mockado, agora com o schema real de pé).

Verificação adicional direto no Postgres (`\df`) confirmando que as duas RPCs existem com a assinatura exata que o teste espera — sem parâmetro `codigo` em texto puro, só os hashes:

```
public | rede_gerar_convite    | jsonb | codigo_hash text
public | rede_resgatar_convite | jsonb | codigo_hash text, ip_hash text
```

O que ainda falta, fora do escopo deste ticket:

- Um teste de integração real (`tests/rede/rls/rede_convites_rpc.rls.test.ts` ou equivalente) provando as duas funções contra Postgres de verdade: admin gera convite, não-admin recebe `42501`, resgate atômico sob concorrência (isso é especificamente o que `RD-19` cobre — testes de concorrência para convites — então não escrevi esse teste aqui de propósito, pra não pisar no território do Agente Auxiliar).
- Confirmar rate limit de fato persiste entre chamadas (não só que o código compila).
