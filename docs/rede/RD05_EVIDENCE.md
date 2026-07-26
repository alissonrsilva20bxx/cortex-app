# RD-05 — Evidência local

**Data:** 2026-07-26
**Ambiente:** Supabase local (`supabase start` / `supabase db reset`, Docker), worktree `agent/claude-issue-7`
**Produção/remoto:** não acessados — nenhum comando abaixo tocou o Supabase remoto.

## 1. Migration aplica limpa e é idempotente

`supabase db reset` (recria o banco do zero e reaplica todas as migrations,
`0001`→`0009`) rodado duas vezes seguidas. Na segunda vez, `0009_rede_conteudo.sql`
só produz `NOTICE ... does not exist, skipping` para os `drop trigger/policy if
exists` — sinal de idempotência, não erro:

```
Applying migration 0009_rede_conteudo.sql...
NOTICE (00000): trigger "rede_posts_updated_at" for relation "public.rede_posts" does not exist, skipping
NOTICE (00000): policy "rede_posts: member select" for relation "public.rede_posts" does not exist, skipping
... (mesmo padrão para as demais policies de rede_posts/rede_comentarios/rede_curtidas)
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch main.
```

## 2. Suíte completa (5 arquivos, 61 testes)

```
$ npm test

 RUN  v4.1.10

 Test Files  5 passed (5)
      Tests  61 passed (61)
```

## 3. Suíte focada de RD-05 (`tests/rede/rls/rede_conteudo.rls.test.ts`), 15 testes

```
✓ rede_posts > hides posts from an author the reader has blocked
✓ rede_posts > still lets the blocked author read their own post
✓ rede_posts > rejects a post insert forged on behalf of another author
✓ rede_posts > rejects a post insert from an authenticated non-member
✓ rede_posts > hides posts entirely from an authenticated non-member
✓ rede_posts > lets only the owner update or delete their post
✓ rede_posts > does not expose rede_posts to anon
✓ rede_comentarios > hides comments from an author the reader has blocked
✓ rede_comentarios > rejects a comment insert forged on behalf of another author
✓ rede_comentarios > lets only the owner update or delete their comment
✓ rede_curtidas > lets a member like a post exactly once and rejects a duplicate
✓ rede_curtidas > rejects a like forged on behalf of another user
✓ rede_curtidas > lets any member see the like count (no block filtering on curtidas)
✓ rede_curtidas > lets only the owner remove their own like
✓ keeps service-role access for fixture and server workflows

Test Files  1 passed (1)
     Tests  15 passed (15)
```

## 4. Critério de aceite do ticket, verificado ponto a ponto

- **"Usuário bloqueado por A não aparece na leitura de posts que A faz, mesmo
  que o post exista na tabela"**: coberto por
  `hides posts from an author the reader has blocked` — o post do autor
  bloqueado continua existindo (visível para `neutralReader` e para o próprio
  autor via `service_role`/dono), mas some da leitura de `blockerA` via a
  policy `rede_posts: member select`, que usa o novo helper
  `public.rede_bloqueio_mutuo(autor_id)` (checa bloqueio nos dois sentidos
  contra `rede_bloqueios`, mesmo padrão `security definer` de
  `rede_is_member`). O mesmo helper é reaplicado em
  `rede_comentarios: member select`, coberto por
  `hides comments from an author the reader has blocked`.
- **"Curtida duplicada do mesmo usuário no mesmo post é impedida pela PK
  composta"**: coberto por
  `lets a member like a post exactly once and rejects a duplicate` — o
  segundo `insert` do mesmo `(post_id, user_id)` retorna `23505` (violação de
  chave primária), sem lógica de aplicação extra.

## 5. Segurança confirmada

- RLS habilitada em `rede_posts`, `rede_comentarios` e `rede_curtidas` na
  mesma migration que as cria.
- `anon` sem nenhum privilégio nas três tabelas (`does not expose rede_posts
to anon`, erro `42501 permission denied for table rede_posts`).
- `authenticated` não-membro (sem convite resgatado) não lê nem escreve
  (`rejects a post insert from an authenticated non-member`,
  `hides posts entirely from an authenticated non-member`) — a policy exige
  `rede_is_member()` além da checagem de bloqueio.
- Escrita (`insert`/`update`/`delete`) em `rede_posts`/`rede_comentarios` só
  pelo dono (`autor_id = auth.uid()`); tentativa de forjar `autor_id` de
  outra pessoa é rejeitada pela RLS (`42501`), não só filtrada.
- `rede_curtidas`: sem `update` (linha imutável, só toggle via
  insert/delete); `select` aberto a qualquer membro (sem exclusão de
  bloqueio, conforme `SUPABASE_MIGRATION_PLAN.md` §2 — curtida é contagem
  pública entre membros); só o próprio `user_id` insere/remove sua curtida.
- `service_role` mantém CRUD completo para fixtures/fluxos server-side.
- `tsc --noEmit`: sem erros. `next lint`: mesmo warning pré-existente de
  `components/cofre/CofreTab.tsx` (`jsx-a11y/alt-text`), não relacionado a
  esta migration.
- Após a suíte: `afterAll` remove todos os usuários de teste
  (`rede-test-%@example.test`) via `deleteTestUser`, sem falha reportada.

## 6. Objetos criados por esta migration (para reversão pontual, se necessário)

- Tipo `public.rede_post_categoria` (enum).
- Tabelas `public.rede_posts`, `public.rede_comentarios`,
  `public.rede_curtidas`.
- Índices `rede_posts_autor_criado_idx`, `rede_posts_categoria_idx`,
  `rede_comentarios_post_criado_idx`.
- Trigger `rede_posts_updated_at` (reusa `public.set_updated_at()` de
  `0001`).
- Função `public.rede_bloqueio_mutuo(uuid)` (`security definer`).
- Policies: `rede_posts: member select/owner insert/owner update/owner
delete`; `rede_comentarios: member select/owner insert/owner update/owner
delete`; `rede_curtidas: member select/owner insert/owner delete`.

Nenhuma dessas mudanças foi aplicada contra o Supabase remoto; `supabase
stop` foi rodado ao final e `.env.test.local` (gitignored) não foi
commitado.
