# Auditoria do Backend Atual — JobApp

**Data:** 2026-07-25
**Escopo:** auditoria 100% local, feita a partir do código-fonte na branch `agent/claude-backend-foundation` (worktree isolado, base `origin/release/rede-teaser-preview`). Nenhuma chamada ao Supabase remoto foi feita — nenhuma leitura de tabelas, nenhum acesso ao dashboard, nenhuma leitura de `.env.local`.

Convenção usada abaixo: cada afirmação é marcada como **[código]** (verificável diretamente no repositório) ou **[conferir remoto]** (só pode ser confirmado olhando o projeto Supabase real, que este agente não acessou).

---

## 1. Visão geral da stack

- **Framework:** Next.js 14.2.5, App Router, TypeScript. **[código]**
- **Backend as a Service:** Supabase (Postgres + Auth + Storage). Não há backend próprio (sem Express/Nest/servidor separado) — a "API" do app é: (a) Supabase acessado diretamente do client via RLS, e (b) um punhado de Route Handlers do Next para os casos que exigem service role ou execução server-side. **[código]**
- **Deploy:** Vercel (`vercel.json` define 1 cron job). **[código]**
- **Prisma** aparece em `package.json` (`@prisma/client`, `prisma`, script `"prisma": "prisma"`) mas **não há `schema.prisma`, nem `prisma/` no repo, nem nenhum import de `@prisma/client` em código**. É dependência morta — o acesso a dados é 100% via `@supabase/supabase-js` / `@supabase/ssr`. **[código]**
- Projeto Supabase referenciado em `MASTER_PROMPT.md`: `https://seciereacfestemdhzhp.supabase.co` (URL pública, não é segredo). **[código]**

## 2. Autenticação

- Único método: **Google OAuth via Supabase Auth** — decisão registrada em `docs/adr/0001-google-oauth-exclusivo.md`. Não existe cadastro por e-mail/senha nem modo anônimo. **[código]**
- Fluxo: `app/login/page.tsx` chama `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: origin + '/auth/callback' })` → `app/auth/callback/route.ts` troca o `code` por sessão via `exchangeCodeForSession` e seta cookies na resposta de redirect. **[código]**
- `middleware.ts` roda em (quase) toda rota (matcher exclui apenas assets estáticos), lê o usuário via `supabase.auth.getUser()` e redireciona para `/login` quem não está autenticado e não está em `/login` ou `/auth/*`. **[código]**
- Não há papéis/roles de usuário — todo usuário autenticado tem o mesmo nível de acesso aos próprios dados (modelo single-tenant por `user_id`, sem admin/moderador). **[código]** — relevante para a Rede, que vai precisar de conceitos novos (bloqueio, denúncia, moderação) que hoje não existem.

## 3. Clientes Supabase (`lib/supabase*.ts`)

Três arquivos, três propósitos, e um deles não é usado:

| Arquivo | Cliente | Chave | Uso real |
|---|---|---|---|
| `lib/supabase.ts` | `createBrowserClient` (`@supabase/ssr`) | anon key | **Uso intenso** — é o cliente usado em praticamente todos os componentes client-side (`app/page.tsx` e ~15 componentes) para ler/escrever tabelas e Storage. **[código]** |
| `lib/supabase-server.ts` | `createServerClient` (`@supabase/ssr`) com cookies do Next | anon key | **Não é importado em lugar nenhum do código atual** — arquivo morto/preparado para uso futuro (Server Components/Actions que ainda não existem). `middleware.ts` reimplementa seu próprio cliente inline em vez de reaproveitar este helper. **[código]** |
| `lib/supabaseAdmin.ts` | `createClient` puro (`@supabase/supabase-js`), service role key | service role | Usado **só** em `app/api/cron/notificacoes/route.ts`, para ler dados de todas as usuárias (não apenas da sessão atual). Marcado `import "server-only"` e criado sob demanda (função, não singleton no topo do módulo) — comentário no próprio arquivo explica que isso evita quebrar `next build`. **[código]** |

**Padrão de acesso a dados:** não existe camada de serviço/repositório. Componentes chamam `supabase.from("tabela")...` diretamente (RLS faz o isolamento por `user_id`). Isso é consistente em todo o app hoje, mas é um ponto de atenção para a Rede: sem uma camada intermediária, qualquer regra de negócio nova (bloqueios, visibilidade de perfil, feed) precisa ser reforçada via RLS + validação client-side espalhada, ou o projeto precisa introduzir uma camada de serviço nesse momento. **[código, análise]**

## 4. Rotas de API (`app/api/`)

Só duas rotas reais, mais o callback de auth:

- **`app/api/dashboard/route.ts`** — stub. Retorna `{ message: "JobApp API — em breve" }`, sem lógica. **[código]**
- **`app/api/cron/notificacoes/route.ts`** — a única rota com lógica de backend real:
  - Protegida por header `Authorization: Bearer ${CRON_SECRET}`. **[código]**
  - Usa `supabaseAdmin` para ler todas as `push_subscriptions` e, por usuário, os `jobs` dele.
  - Delega a decisão de "que lembrete enviar" a `lib/notificacoes.ts` (função pura, testável, sem I/O) — no máximo 1 notificação/usuária/dia, prioriza atendimento próximo (≤36h) e depois cliente recorrente.
  - Envia via `web-push` (VAPID), e limpa (`DELETE`) subscriptions que retornam 404/410.
  - Disparada por cron do Vercel (`vercel.json`): `0 11 * * *` (11h UTC = 08h em BRT). **[código]**
- **`app/auth/callback/route.ts`** — descrito na seção 2.
- **`app/pwa-icon/route.tsx`** — gera um ícone PNG dinâmico via `next/og` (`ImageResponse`), roda em edge runtime. Não toca em dados/banco — é só geração de asset visual para o manifest do PWA. **[código]**

Não existem rotas de API para: perfil, feed, posts, comentários, amizades, mensagens, bloqueios, denúncias, convites — ou seja, **zero backend da Rede existe hoje**, além da vitrine estática (seção 6).

## 5. Tabelas — o que existe de fato

Fonte primária usada aqui: `lib/database.types.ts` (tipos gerados a partir do schema do Supabase em algum momento no passado — presumivelmente via `supabase gen types`), cruzado com `supabase/migrations/*.sql` e os scripts soltos em `supabase/*.sql`. **Importante (correção desta revisão):** esses tipos gerados são um snapshot de quando foram gerados, não uma leitura do estado atual do banco. Nada nesta seção prova o que existe no Supabase remoto *hoje* — só o que existia quando o snapshot e os scripts foram escritos. Confirmar o estado atual exige auditoria remota direta, que este agente não tem acesso para fazer.

| Tabela | Migration que a criou | RLS | Observação |
|---|---|---|---|
| `jobs` | `0001_jobapp_schema.sql` | Sim — `owner full access` por `user_id` | Índice `jobs_user_data_idx (user_id, data)`; trigger `set_updated_at`. **[código]** |
| `metas` | `0001` | Sim | `unique(user_id, periodo)`; seed automático (dia/mês/ano) via trigger `handle_new_user` em `auth.users`. **[código]** |
| `notas` | `0001` | Sim | Trigger `set_updated_at`. **[código]** |
| `configuracoes` | `0001` (+ alterada por `0002`) | Sim | PK é `user_id` (1:1 com o usuário). `0002` adicionou `trial_started_at` e `assinatura_status`. **[código]** |
| `push_subscriptions` | `0003_push_subscriptions.sql` | Sim | `endpoint` é `unique`; sem coluna de preferência — existência da linha = opt-in (documentado no próprio SQL). **[código]** |
| `despesas` | **Não está em `supabase/migrations/`** — existe só como script solto `supabase/criar_despesas.sql`, com instrução para rodar manualmente no SQL Editor do Supabase. | Sim (no script) | Está presente em `lib/database.types.ts`. Isso é **indício** de que foi aplicada no banco remoto em algum momento — não é prova do estado atual: os tipos gerados são um snapshot, podem estar desatualizados, e nada aqui confirma que colunas, constraints, triggers ou policies do remoto batem com o script hoje. **[código + inferência — há indícios; confirmar no remoto antes de agir, ver `SUPABASE_MIGRATION_PLAN.md` §0a]** |
| `receitas_avulsas` | Idem — só em `supabase/criar_objetivos.sql` (script solto, nome do arquivo não bate com o conteúdo — o arquivo cria *duas* tabelas: `receitas_avulsas` e `objetivos`). | Sim (no script) | Mesma situação: presente nos types gerados, ausente das migrations numeradas. **[código + inferência]** |
| `objetivos` | Idem (`supabase/criar_objetivos.sql`). | Sim (no script) | Mesma situação. **[código + inferência]** |

**Achado importante — indício, não fato confirmado (corrigido nesta revisão):** há fortes indícios de que `supabase/migrations/` **não é a fonte da verdade do schema atual** — pelo menos 3 tabelas (`despesas`, `receitas_avulsas`, `objetivos`) e pelo menos 1 alteração de enum (`tema`, ver abaixo) aparecem em `lib/database.types.ts` sem migration numerada correspondente em `supabase/migrations/`. Isso é inferência a partir de um snapshot de tipos gerados no passado — **não é uma leitura do estado atual do banco remoto**, que este agente não acessou. Antes de agir sobre essa divergência (ex.: escrever uma migration de correção), é necessária uma auditoria remota somente leitura para confirmar o que existe hoje de fato — ver `SUPABASE_MIGRATION_PLAN.md` §0a. Se confirmado, é risco direto para a Rede: se a Rede seguir o padrão de "rodar SQL solto no dashboard", o histórico de schema vai continuar divergindo do que está versionado.

**Enum `tema` possivelmente desatualizado no SQL versionado:** `0001_jobapp_schema.sql` cria `tema` com 3 valores (`pink-neon`, `purple`, `crimson`), mas `lib/theme.ts` e o snapshot de `lib/database.types.ts` já trabalham com 8 temas (`grafite`, `pink-neon`, `purple`, `crimson`, `ocean`, `gold`, `emerald`, `midnight`). Isso **sugere** que o enum no banco remoto passou por `ALTER TYPE ... ADD VALUE` várias vezes sem registro em `supabase/migrations/` — mas é inferência a partir de um snapshot, não confirmação do estado atual. **[código + inferência — há indícios; precisa `\dT+ tema` (ou `select enum_range(null::tema)`) no remoto para confirmar os valores atuais antes de qualquer migration de correção]**

## 6. A "Rede" hoje: só vitrine estática

`components/rede/` (fora do escopo de edição deste agente, mas lido para contexto) contém:

- `RedeTeaserTab.tsx` — tela 100% estática dentro do app oficial. Mostra posts fake (`TEASER_POSTS`, hardcoded no componente), um hero, uma lista de "benefícios" e dois `BottomSheet`s (waitlist de beta e prévia de features). **`pointerEvents: "none"` nos cards de post** — nada é clicável, não há fetch, não há estado vindo do Supabase. **[código]**
- `Avatar.tsx` — componente de avatar por iniciais/cor sólida (sem foto real), com modo "anônimo" (ícone neutro). Já dá uma pista de requisito de produto: **posts/comentários anônimos são um caso previsto na UI**, mesmo sem existir no backend ainda. **[código]**
- O teaser cita 4 blocos futuros: **Feed**, **Perfil** (com "LiveLinks e vitrine pública"), **Amigas** (conexões), **Conversas** (mensagens privadas). Isso é o único artefato de produto que descreve o escopo da Rede — não há PRD/spec formal encontrado no repo além disso e do texto solto no teaser.
- Preço mencionado no teaser: "Plano previsto: R$ 49,90/mês", como parte de um produto separado chamado **"JobApp Rede"**. **[código]** — sugere que a Rede pode ser um plano/produto à parte do JobApp base (relevante para o modelo de "planos e permissões" em `BETA_DOMAIN_MODEL.md`).

Nenhuma tabela, policy, endpoint ou tipo relacionado a perfil público, post, comentário, curtida, amizade, conversa, mensagem, bloqueio, denúncia ou convite beta existe no código hoje. **[código]**

## 7. Storage

- 1 bucket privado: `cofre` (criado em `0001_jobapp_schema.sql`, `public: false`). **[código]**
- Path convention: `{user_id}/{categoria}/{filename}`, categorias fixas (`comprovantes`, `conversas`, `documentos`, `pessoal`). **[código]**
- Policy: dono tem acesso total, isolado pelo primeiro segmento do path (`auth.uid()::text = split_part(name,'/',1)`). **[código]**
- Acesso: upload direto do client (`UploadSheet.tsx`), listagem via `.list()`, leitura via `createSignedUrl` (120s de validade) — nunca URL pública. **[código]**
- Documentado em `docs/adr/0002-cofre-supabase-storage.md` (motivo: isolar do localStorage/IndexedDB, RLS real). **[código]**
- Para a Rede: nenhum bucket de mídia de post/perfil existe ainda (avatar real, imagens de post, etc. — hoje `Avatar.tsx` só usa iniciais, sem foto).

## 8. Variáveis de ambiente referenciadas no código

Listadas apenas pelos **nomes** encontrados via grep de `process.env.*` — nenhum valor foi lido, `.env.local` não foi aberto:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — usadas em `middleware.ts`, `lib/supabase.ts`, `lib/supabase-server.ts`, `lib/supabaseAdmin.ts`, `app/auth/callback/route.ts`.
- `SUPABASE_SERVICE_ROLE_KEY` — só em `lib/supabaseAdmin.ts`.
- `CRON_SECRET` — só em `app/api/cron/notificacoes/route.ts`, protege o cron.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — push notifications (`lib/push.ts`, rota do cron).
- `NODE_ENV` — uso padrão do Next em `app/layout.tsx`.

**[código]** — confirmar apenas que todas estão de fato configuradas na Vercel/`.env.local` é responsabilidade de quem tem acesso a esses valores; este agente não verificou. **[conferir remoto]**

## 9. Inconsistências e riscos identificados

1. **Migrations possivelmente incompletas** — há indícios (não confirmação direta) de que `supabase/migrations/` não reflete o schema real (seção 5). Antes de decidir como corrigir, é necessário auditar o remoto somente leitura. Ver `SUPABASE_MIGRATION_PLAN.md` §0a. **[código + inferência — confirmar no remoto]**
2. **`lib/supabase-server.ts` morto** — helper pronto para Server Components/Actions mas nunca importado; `middleware.ts` duplica a mesma lógica inline. Se a Rede precisar de leitura server-side (ex.: feed com SSR para SEO/perf), vale decidir se reaproveita este arquivo ou remove.
3. **`prisma` como dependência morta** — nenhum schema, nenhum uso. Não é bloqueante, mas é ruído (instala client do Prisma sem necessidade). Fora do escopo de alteração deste agente (não mexi em `package.json`), só registro o achado.
4. **Sem camada de serviço/repositório** — acesso a dados via `supabase.from(...)` espalhado direto nos componentes. Funciona para o modelo atual (dados 100% privados por `user_id`), mas a Rede introduz dados **compartilhados entre usuários** (perfis públicos, posts, feed, amizades) — isso é uma mudança de modelo de ameaça, não só "mais tabelas". Regras de visibilidade/bloqueio precisam de RLS bem desenhada desde o início, porque não há camada de aplicação central para compensar uma RLS fraca.
5. **Nenhum conceito de moderação/roles existe hoje** — a Rede exige bloqueios, denúncias e (provavelmente) algum nível de moderação. Isso não tem nenhum precedente no código atual para reaproveitar; é modelo novo do zero.
6. **`app/api/dashboard/route.ts` é stub morto** — não referenciado por nenhum client conhecido no código lido; útil como candidato a rota real ou para remoção futura (fora do escopo deste agente).
7. **Enum `tema` desatualizado no SQL versionado** (seção 5) — mesmo padrão do item 1, mas isolado aqui porque é sobre `ALTER TYPE`, não `CREATE TABLE`.
8. **`configuracoes` permite hoje que o próprio usuário altere `assinatura_status` e `trial_started_at`** — a policy `"configuracoes: owner full access"` (`0001_jobapp_schema.sql`) é `FOR ALL USING/WITH CHECK (auth.uid() = user_id)`, sem restrição por coluna. Isso significa que, tecnicamente, um usuário autenticado consegue chamar `supabase.from('configuracoes').update({ assinatura_status: 'ativa' })` com a própria sessão (anon key) e conceder a si mesmo uma assinatura ativa, sem passar por nenhuma validação de pagamento. **[código — verificável direto na policy da migration 0001]** Não é uma vulnerabilidade descoberta especificamente para a Rede, mas é o mesmo padrão de risco que a modelagem de `rede_assinaturas` precisa evitar repetir — ver `BETA_DOMAIN_MODEL.md` §9 e `SUPABASE_MIGRATION_PLAN.md` §2. Corrigir isso no JobApp base é decisão do dono do produto e está fora do escopo de alteração deste agente (não mexi em `configuracoes`); registro o achado para conhecimento.

## 10. O que precisa ser conferido no Supabase remoto (não feito por este agente)

- Confirmar que `despesas`, `receitas_avulsas` e `objetivos` no banco remoto batem exatamente com os scripts soltos (colunas, constraints, policies) — schema pode ter divergido desde que o script rodou.
- Confirmar os valores atuais do enum `tema` (`\dT+ tema` ou `select enum_range(null::tema)`).
- Confirmar se há policies de Storage além da de `cofre` (buckets criados manualmente não apareceriam nas migrations).
- Confirmar se todas as env vars da seção 8 estão de fato configuradas em Produção e Preview na Vercel.
- Confirmar se existem Postgres Functions/Triggers adicionais criados manualmente (só `set_updated_at` e `handle_new_user` estão no SQL versionado).
- Confirmar se Realtime está habilitado em alguma tabela hoje (nenhuma referência a `supabase.channel(...)` foi encontrada no código, então a expectativa é que não esteja em uso — mas vale confirmar no dashboard).
- **Antes de qualquer migration de correção de baseline** (ticket `RD-000`/`RD-00` em `BACKEND_TICKETS.md`): fazer um diff explícito e documentado entre o schema remoto real (dump/`information_schema`) e `supabase/migrations/*.sql` + scripts soltos, e ensaiar a correção num banco descartável antes de tocar no remoto de produção — ver `SUPABASE_MIGRATION_PLAN.md` §0a.
