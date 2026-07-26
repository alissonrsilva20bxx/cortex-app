# RD-07 — Evidência local

**Data:** 2026-07-26
**Ambiente:** Supabase local descartável `cortex-app` (via `supabase start`/`db reset`)
**Remoto:** Supabase remoto, secrets e deploy não acessados; nenhuma migration remota aplicada, nenhum merge/deploy feito.

## Desenho

- `rede_denuncias` com alvo polimórfico (`alvo_tipo` enum `post`/`comentario`/`usuario`/`mensagem`, `alvo_id uuid` sem FK tipada — ver `BETA_DOMAIN_MODEL.md` §7).
- `status` (`pendente`/`revisada`/`resolvida`), `motivo` (`spam`/`assedio`/`conteudo_impropio`/`outro`).
- `CHECK rede_denuncias_revisao_consistente`: `revisado_em`/`revisado_por` são nulos exatamente enquanto `status = 'pendente'`, e obrigatórios em qualquer outro status — mesmo padrão de consistência usado em `rede_convites_uso_consistente` (0005).
- `CHECK rede_denuncias_descricao_valida`: campo livre opcional, mas se presente não pode ser vazio/whitespace nem passar de 2000 caracteres — mesmo espírito de `rede_mensagens_texto_valido` (0010).
- Trigger `rede_validar_revisao_denuncia` (antes do `UPDATE`) restringe a trilha de transição: `pendente -> revisada|resolvida`, `revisada -> resolvida`; nunca volta para `pendente`; `resolvida` é terminal; `revisado_por` tem que ser o próprio `auth.uid()` de quem está revisando (não dá para um admin registrar outro admin como revisor). Mesmo padrão de trigger de transição de `rede_validar_resposta_amizade` (0008) e `rede_validar_leitura_mensagem` (0010).
- RLS reaproveita o helper `rede_is_admin()` já existente desde 0005 (evita duplicar a checagem de allowlist) e `rede_is_member()` de 0006 para exigir que só membro da Rede consiga denunciar.
- `SELECT`: denunciante vê a própria denúncia (`denunciante_id = auth.uid()`) ou admin vê todas.
- `INSERT`: só o próprio denunciante, membro, e só com `status = 'pendente'`/`revisado_em`/`revisado_por` nulos (não dá para já nascer revisada).
- `UPDATE`: coluna liberada só para `status`/`revisado_em`/`revisado_por`, e a policy exige `rede_is_admin()` nos dois lados (`using`/`with check`); o trigger cobre a validação fina da transição.
- Sem policy de `DELETE` para `authenticated` — fila mínima não precisa disso; só `service_role` remove linhas (fixtures/uso administrativo direto no banco).

## Garantias verificadas (12 testes, `tests/rede/rls/rede_denuncias.rls.test.ts`)

- membro denuncia outro usuário; denunciante lê a própria denúncia; outro membro não vê; admin vê;
- os quatro valores de `alvo_tipo` (post/comentário/usuário/mensagem) são aceitos;
- denúncia forjada em nome de outro usuário é rejeitada pela RLS;
- não membro autenticado não consegue denunciar;
- inserir já com `status`/`revisado_por` preenchido é rejeitado pela RLS;
- `descricao` vazia ou maior que 2000 caracteres é rejeitada pelo `CHECK`;
- não admin não consegue mudar `status` (0 linhas afetadas, sem erro — mesmo padrão dos outros testes de RLS de update); admin consegue mover `pendente -> revisada`;
- admin consegue resolver diretamente de `pendente -> resolvida` (pula `revisada`);
- transição de volta para `pendente`, revisor forjado (outro `user_id` que não o do admin autenticado) e transição depois de `resolvida` são todas rejeitadas pelo `CHECK`/trigger;
- nenhum usuário autenticado (nem denunciante, nem admin) consegue `DELETE`;
- `anon` não tem nenhum privilégio na tabela;
- `service_role` mantém acesso completo para fixtures/uso administrativo.

## Validação final

Migration aplicada limpa contra `0001`...`0010` existentes; `supabase db reset` executado duas vezes seguidas sem erro (só `NOTICE ... does not exist, skipping` esperado do próprio `drop ... if exists`/`drop trigger/policy if exists` de cada migration anterior sendo reaplicada, sem indicar duplicação):

```text
npx vitest run tests/rede/rls/rede_denuncias.rls.test.ts

Test Files 1 passed
Tests 12 passed
```

Suíte completa (regressão + RD-07) depois do segundo reset:

```text
npx vitest run

Test Files 7 passed
Tests 90 passed

npx tsc --noEmit
(sem erros)
```

Inspeção final confirmou zero usuários `rede-test-%@example.test` e zero linhas em `public.rede_denuncias` no banco local (via `psql` direto no container `supabase_db_cortex-app`) — o `afterAll` de cada suíte limpou os próprios usuários/fixtures.

## O que este ticket não faz

- Não implementa workflow de moderação completo (fila com atribuição, SLA, notificação) — é fila mínima, conforme escopo do ticket.
- Não cria `lib/rede/denuncias.ts`/`lib/rede/admin.ts` (isso é `RD-14`, que depende também de `RD-09`).
- Não aplica nenhuma migration no Supabase remoto, não faz merge, não faz deploy.
