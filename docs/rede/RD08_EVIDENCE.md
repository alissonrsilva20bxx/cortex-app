# RD-08 — Evidência de execução

**Ambiente:** worktree `C:\Users\miguel\JobApp-Claude-RD08`, branch `agent/claude-backend-rd08` (base: `origin/agent/codex-rd10-review`).
**Data:** 2026-07-28.
**Nenhum comando abaixo tocou o Supabase remoto.** Nenhum merge/push foi feito.

## 0. Nota de escopo

`SUPABASE_MIGRATION_PLAN.md` §5 e `BACKEND_TICKETS.md` (RD-08) marcavam este ticket como "fora do MVP — proposta". Executado por instrução explícita do dono do produto nesta sessão (2026-07-28). Registrando para rastreabilidade.

## 1. `supabase/migrations/0014_rede_storage.sql`

Numeração `0014` (não `0012`, já ocupado por `rede_reordenar_livelinks` neste branch base, nem `0013`, reservado para `rede_convites_rpc` que existe no sandbox do Codex mas ainda não foi pushado — `0014` evita colisão futura com qualquer um dos dois).

- Bucket `rede-midia`: privado na criação (`public: false`), mas com policy de leitura aberta a qualquer membro — diferente do `cofre`, que só serve via signed URL.
- **Limite aplicado, não deixado em aberto:** `file_size_limit = 10485760` (10 MB, mesmo teto sugerido para o `cofre` no ADR 0002) e `allowed_mime_types` restrito a `image/jpeg`, `image/png`, `image/webp`, `image/gif`. `SUPABASE_MIGRATION_PLAN.md` §5 deixava isso como decisão de produto em aberto com essa sugestão; apliquei o valor sugerido como default explícito em vez de subir o bucket sem limite nenhum (um bucket sem `file_size_limit` aceita upload de qualquer tamanho até o teto global do projeto — risco de custo/abuso desde o primeiro upload). Se o produto quiser outro valor, é um `UPDATE` em `storage.buckets`, não uma migration nova.
- Convenção de path do domínio (`{user_id}/posts/{post_id}/{filename}`, `{user_id}/perfil/{filename}`): a policy só examina o primeiro segmento do path (dono), então as duas convenções compartilham a mesma regra sem precisar hardcodar "posts" ou "perfil".
- 4 policies em `storage.objects`, mesmo padrão idempotente (`do $$ if not exists ... $$`) já usado nas migrations da Rede: `owner insert` (exige `rede_is_member()` + path do próprio usuário), `member select` (qualquer membro, sem checar dono), `owner update`/`owner delete` (só dono).

## 2. `tests/rede/storage/rede-midia.storage.test.ts`

Primeiro teste de Storage da suíte — não havia padrão anterior pra seguir (todos os testes existentes são de RLS via Postgres ou de service, nenhum via `storage.from(...)`). Nove casos:

- Upload no próprio path funciona.
- Upload forjado no path de outro membro é rejeitado.
- Upload de não-membro é rejeitado.
- **Leitura por qualquer membro funciona** (a diferença central em relação ao `cofre`) — `otherMember` faz `download()` de um arquivo que não é dele e recebe o conteúdo.
- Leitura por não-membro é negada.
- `anon` não acessa nada (nem upload, nem download).
- Outro membro tentando apagar o arquivo do dono não afeta nada (RLS filtra a linha do `remove()`, arquivo confirmado ainda acessível depois).
- O dono consegue apagar o próprio arquivo.
- Upload acima de 10 MB e upload com MIME fora da lista permitida são rejeitados pelo próprio bucket (não pela policy de RLS — validação de `storage.buckets.file_size_limit`/`allowed_mime_types`).

## 3. `tsc --noEmit` — passou

`npm install` (504 pacotes) + `npx tsc --noEmit`: saída vazia, zero erros. O teste de Storage não depende de `lib/database.types.ts` (a API de Storage do client Supabase não é tipada pelo schema do Postgres), então não houve necessidade de mudança nos tipos para este ticket.

## 4. Execução — status: **pendente, Docker local sem resposta**

Mesma situação já registrada em `RD03_EVIDENCE.md`/`RD05B_EVIDENCE.md`: `docker exec ... pg_isready` contra `supabase_db_cortex-app` deu timeout em todas as tentativas desta sessão. Migration, policies e teste estão prontos; falta `supabase db reset && npm test` assim que o stack responder.

## 5. O que ainda falta para fechar este ticket

- Confirmar `supabase status`.
- `supabase db reset` (aplica `0014` em sequência).
- `npm test -- rede-midia` e colar a saída aqui.
