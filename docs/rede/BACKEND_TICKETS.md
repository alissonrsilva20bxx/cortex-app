# Tickets de Backend — Rede

**Data:** 2026-07-25
**Status:** planejamento — nenhum ticket abaixo foi implementado por este agente.

## Regras que valem para quem for pegar qualquer ticket abaixo

- **Nunca editar diretamente:** `app/page.tsx`, `app/layout.tsx`, `components/BottomNav.tsx`, `middleware.ts`, `lib/types.ts`, `components/rede/`. Esses arquivos são reservados (dono é o app principal / frontend da Rede) — nenhum ticket de backend deveria precisar deles, e se algum parecer precisar, é sinal de que o ticket está mal escopado.
- Todo ticket que cria tabela nova cria RLS **na mesma migration** — nunca em migration separada.
- Nenhum ticket roda `git push`, merge, ou aplica migration contra o Supabase remoto automaticamente — cada migration é revisada e aplicada manualmente (mesmo fluxo manual que o projeto já usa hoje, descrito em `MASTER_PROMPT.md`).
- **Escopo do MVP (adicionado nesta revisão):** cada ticket abaixo está marcado como **MVP** (bloqueia o lançamento do beta mínimo) ou **fora do MVP — proposta** (não bloqueia, decide-se depois). Ver `BETA_DOMAIN_MODEL.md` §0 para a lista completa. Nenhum ticket fora do MVP deveria travar a execução de um ticket MVP.
- **Nenhuma migration de reconciliação de schema roda sem auditoria remota prévia** — ver `RD-000` abaixo e `SUPABASE_MIGRATION_PLAN.md` §0a.

## Ordem de execução (visão geral)

```
RD-000 (auditoria remota somente leitura + diff) [MVP — pré-requisito de processo]
  └── RD-00 (baseline, condicionado ao diff de RD-000) [MVP]
        └── RD-01 (beta gating) [MVP]
              ├── RD-02 (perfis) [MVP]
              │     ├── RD-03 (assinaturas) [fora do MVP — proposta]
              │     ├── RD-04 (social graph) [MVP]               ┐
              │     │     ├── RD-05 (conteúdo, texto) [MVP]       │ paralelizáveis entre si
              │     │     │     └── RD-05b (posts anônimos)       │ [fora do MVP — proposta]
              │     │     └── RD-06 (mensageria + realtime) [MVP] ┘
              │     └── RD-08 (storage) [fora do MVP — proposta, depende também de RD-05]
              └── RD-07 (denúncias, fila mínima) [MVP] [depende também de RD-05, RD-06]

RD-09 (tipos TS, gerados contra local/staging primeiro) [MVP] — depende de todas as migrations MVP acima
  ├── RD-10 (service perfis/livelinks) [MVP]
  ├── RD-11 (feed, texto — núcleo) [MVP; extensão para anônimos depende também de RD-05b, fora do MVP]
  ├── RD-12 (service social) [MVP]
  ├── RD-13 (service mensagens) [MVP]
  └── RD-14 (service denúncias/admin) [MVP]

RD-15 (endpoint convites, endurecido) [MVP] — depende de RD-01, RD-09
RD-16 (endpoint solicitar beta) [MVP] — depende de RD-01, RD-09

RD-17 (harness de testes local/staging) [MVP] — depende de RD-000
RD-18 (testes automatizados de RLS multiusuário) [MVP] — depende de RD-17 e de cada migration testada
RD-19 (testes de concorrência: convites/amizades/curtidas/conversa única) [MVP] — depende de RD-17, RD-04, RD-05, RD-13, RD-15
RD-20 (testes de rotas sem service role no client) [MVP] — depende de RD-15, RD-16
```

## Tickets

### RD-000 — Auditoria remota somente leitura + diff de schema

- **Escopo:** MVP (pré-requisito de processo). Adicionado nesta revisão a pedido do Codex.
- **Depende de:** nada
- **Arquivos:** nenhum arquivo de schema é criado por este ticket — só documentação do diff (sugestão: `docs/rede/REMOTE_SCHEMA_DIFF.md`, fora dos 5 documentos originais, criar se este ticket for executado).
- **O que faz:** extrai o schema real do Supabase remoto hoje (dump/`information_schema`/`supabase db dump` — **somente leitura**, nenhuma escrita) e compara com `supabase/migrations/*.sql` + scripts soltos, tabela por tabela (colunas, tipos, constraints, defaults, triggers, policies, valores de enum). Ver `SUPABASE_MIGRATION_PLAN.md` §0a.
- **Critério de aceite:** diff documentado e explícito existe antes de qualquer migration de correção ser escrita; um banco descartável reproduzindo o schema real está disponível para ensaiar `RD-00` antes de tocar no remoto de produção.
- **Paralelizável:** não — é pré-requisito de `RD-00` e de `RD-17`.

### RD-00 — Corrigir histórico de migrations (baseline)

- **Escopo:** MVP (pré-requisito de processo).
- **Depende de:** RD-000 (o diff precisa existir e ser confirmado antes desta migration ser escrita)
- **Arquivos:** novo `supabase/migrations/0004_baseline_correcao.sql`
- **O que faz:** reconcilia o schema com base no diff confirmado por `RD-000` — provavelmente recria `despesas`, `receitas_avulsas`, `objetivos` e o `ALTER TYPE tema ADD VALUE`, mas com as definições exatas que o diff confirmar, não assumindo que os scripts soltos em `supabase/*.sql` ainda batem 100% com o remoto. Ver `CURRENT_BACKEND_AUDIT.md` §5 e `SUPABASE_MIGRATION_PLAN.md` §0b.
- **Critério de aceite:** testada primeiro no banco descartável de `RD-000`; rodar o script duas vezes seguidas não gera erro; rodar num banco vazio cria as tabelas com o shape confirmado pelo diff (não só o shape assumido por `lib/database.types.ts`).
- **Paralelizável:** não — depende de `RD-000`, e tudo depois depende dela.

### RD-01 — Migration: gating de beta

- **Escopo:** MVP.
- **Depende de:** RD-00
- **Arquivos:** novo `supabase/migrations/0005_rede_beta_gating.sql`
- **O que faz:** cria `rede_solicitacoes_beta`, `rede_convites`, `rede_admins` com RLS (ver `SUPABASE_MIGRATION_PLAN.md` §2).
- **Critério de aceite:** usuário autenticado consegue inserir a própria solicitação e não consegue ler solicitação de outro `user_id`; só linha em `rede_admins` habilita leitura ampla de `rede_convites` (testar com 2 contas de teste).
- **Paralelizável:** não.

### RD-02 — Migration: perfis e LiveLinks

- **Escopo:** MVP.
- **Depende de:** RD-01
- **Arquivos:** novo `supabase/migrations/0006_rede_perfis.sql`
- **O que faz:** cria `rede_perfis`, `rede_livelinks` com RLS condicionada a convite resgatado.
- **Critério de aceite:** usuário sem convite resgatado não consegue criar linha em `rede_perfis` (policy rejeita o `INSERT`); usuário com convite consegue; qualquer membro consegue `SELECT` no perfil de outro membro.
- **Paralelizável:** não (é dependência de quase tudo depois).

### RD-03 — Migration: assinaturas da Rede

- **Escopo:** **fora do MVP — proposta.** Não bloqueia o lançamento do beta; entra quando o produto decidir o modelo de billing da Rede.
- **Depende de:** RD-02
- **Arquivos:** novo `supabase/migrations/0007_rede_assinaturas.sql`
- **O que faz:** cria `rede_assinaturas`, independente de `configuracoes.assinatura_status` (ver `BETA_DOMAIN_MODEL.md` §9).
- **Bloqueador crítico corrigido nesta revisão:** RLS **não pode** ser "dono tem acesso total". `SELECT` só do dono; `INSERT`/`UPDATE`/`DELETE` só via service role/webhook server-side, nunca pelo client autenticado.
- **Critério de aceite (obrigatório, não opcional):** teste automatizado que prove que um cliente autenticado comum **não consegue** se autoativar, reiniciar trial, ou alterar `status`/`trial_started_at` via `UPDATE`/`INSERT` direto — nem com a própria sessão válida. Toda escrita privilegiada precisa ser idempotente e auditável (log de quem/quando mudou o status).
- **Paralelizável com:** RD-04.

### RD-04 — Migration: grafo social (amizades e bloqueios)

- **Escopo:** MVP.
- **Depende de:** RD-02
- **Arquivos:** novo `supabase/migrations/0008_rede_social_graph.sql`
- **O que faz:** cria `rede_amizades` (com índice único por par não-ordenado) e `rede_bloqueios`.
- **Critério de aceite:** pedido de amizade duplicado (nos dois sentidos) é rejeitado pelo índice único; usuário só vê linhas onde aparece como uma das duas pontas.
- **Paralelizável com:** RD-03.

### RD-05 — Migration: conteúdo (posts, comentários, curtidas)

- **Escopo:** MVP (texto, não-anônimo).
- **Depende de:** RD-04
- **Arquivos:** novo `supabase/migrations/0009_rede_conteudo.sql`
- **O que faz:** cria `rede_posts`, `rede_comentarios`, `rede_curtidas` com RLS que exclui autores bloqueados (ver `SUPABASE_MIGRATION_PLAN.md` §2).
- **Critério de aceite:** usuário bloqueado por A não aparece na leitura de posts que A faz, mesmo que o post exista na tabela; curtida duplicada do mesmo usuário no mesmo post é impedida pela PK composta.
- **Paralelizável com:** RD-06.

### RD-05b — Ocultar autor em posts anônimos

- **Escopo:** **fora do MVP — proposta a validar com o produto.** Só entra em planejamento se/quando anonimato for confirmado como requisito real — a versão anterior deste conjunto de documentos tratava isso como confirmado por engano; não estava (ver `BETA_DOMAIN_MODEL.md` §3).
- **Depende de:** RD-05
- **Arquivos:** novo `supabase/migrations/0009b_rede_posts_anonimos.sql`
- **O que faz, se aprovado:** resolve a lacuna registrada em `BETA_DOMAIN_MODEL.md` §3 — RLS de linha não esconde coluna, então isso precisa de uma `view` (ex. `rede_posts_publico`) ou função `security definer` que omite `autor_id` de quem não é o dono quando `anonimo = true`. Acesso direto à tabela base é revogado para o role do client; só a view/função tem `SELECT`. Grants mínimos na função, `search_path` fixo.
- **Critério de aceite:** consulta feita por um usuário B a um post anônimo de A não retorna `autor_id = A` em nenhum campo, incluindo via `join`; consulta feita pelo próprio A ou por admin retorna o dado completo; teste adversarial dedicado contra vazamento de `autor_id`.
- **Paralelizável:** não (é refinamento direto de RD-05, mas separado porque é uma decisão de arquitetura própria, testável isoladamente).

### RD-06 — Migration: mensageria + Realtime

- **Escopo:** MVP (texto).
- **Depende de:** RD-04
- **Arquivos:** novo `supabase/migrations/0010_rede_mensageria.sql`
- **O que faz:** cria `rede_conversas`, `rede_conversas_participantes`, `rede_mensagens`; habilita Realtime em `rede_mensagens`.
- **Critério de aceite:** só participantes listados em `rede_conversas_participantes` conseguem ler/inserir mensagens da conversa; evento Realtime de uma mensagem nova só chega a quem é participante — validado com 2 sessões reais **e** coberto por teste automatizado (ver `RD-18`), não só verificação manual pontual.
- **Paralelizável com:** RD-05.

### RD-07 — Migration: denúncias

- **Escopo:** MVP (fila mínima — registrar e permitir que admin marque como revisada; não é workflow de moderação completo).
- **Depende de:** RD-01 (tabela `rede_admins`), RD-05, RD-06
- **Arquivos:** novo `supabase/migrations/0011_rede_denuncias.sql`
- **O que faz:** cria `rede_denuncias` (alvo polimórfico: post/comentário/usuário/mensagem).
- **Critério de aceite:** denunciante vê só a própria denúncia; só quem está em `rede_admins` vê todas e consegue mudar `status`.
- **Paralelizável com:** RD-08.

### RD-08 — Migration: Storage da Rede

- **Escopo:** **fora do MVP — proposta.** Beta mínimo é texto puro (ver `BETA_DOMAIN_MODEL.md` §0); mídia entra depois.
- **Depende de:** RD-02, RD-05
- **Arquivos:** novo `supabase/migrations/0012_rede_storage.sql`
- **O que faz:** cria bucket `rede-midia` + policies (ver `SUPABASE_MIGRATION_PLAN.md` §5).
- **Critério de aceite:** upload só funciona no path do próprio `user_id`; leitura funciona para qualquer membro autenticado (diferente do bucket `cofre`, que é signed-URL only).
- **Paralelizável com:** RD-07.

### RD-09 — Regenerar tipos TS do schema

- **Escopo:** MVP.
- **Depende de:** RD-01, RD-02, RD-04, RD-05, RD-06, RD-07 (as migrations MVP) aplicadas no ambiente onde os tipos serão gerados
- **Arquivos:** `lib/database.types.ts` (regenerado — **não editar à mão**, rodar a ferramenta oficial de geração de tipos do Supabase CLI contra o schema atualizado)
- **Correção desta revisão:** gerar sempre contra um ambiente **local ou staging** primeiro — nunca produção como primeiro passo. Só apontar a geração para produção depois que o resultado já tiver sido validado em staging.
- **Critério de aceite:** `tsc --noEmit` passa; todas as tabelas MVP aparecem no tipo `Database`; geração foi feita contra local/staging antes de qualquer geração contra produção.
- **Paralelizável:** não (bloqueia todos os tickets de service abaixo, que dependem dos tipos).
- **Atenção:** `lib/database.types.ts` é compartilhado com o resto do app (não está na lista de arquivos proibidos, mas é usado por `lib/supabase.ts`, `lib/supabaseAdmin.ts` etc.) — regenerar em vez de editar manualmente evita divergência silenciosa como a descrita na auditoria.

### RD-10 — Serviço: perfis e LiveLinks

- **Escopo:** MVP.
- **Depende de:** RD-02, RD-09
- **Arquivos:** novo `lib/rede/perfis.ts`
- **O que faz:** funções de acesso a dados para CRUD de `rede_perfis`/`rede_livelinks` — primeira peça de uma camada de serviço que hoje não existe no projeto (ver achado #4 da auditoria). Funções puras de I/O, sem estado de UI, para poderem ser chamadas tanto de componentes quanto de rotas de API futuras.
- **Critério de aceite:** funções cobrem create/read/update de perfil e create/read/reorder/delete de LiveLinks; nenhuma lógica de UI misturada.
- **Paralelizável com:** RD-12, RD-13, RD-14.

### RD-11 — Serviço: feed (posts, comentários, curtidas)

- **Escopo:** MVP no núcleo (texto, não-anônimo). Suporte a posts/comentários anônimos é extensão fora do MVP, condicionada a RD-05b.
- **Depende de:** RD-09 (núcleo); RD-05b só é necessária se/quando a extensão de anonimato for aprovada
- **Arquivos:** novo `lib/rede/feed.ts`
- **O que faz:** funções de leitura de feed, criação de post/comentário, toggle de curtida. Suporte a `anonimo` só é adicionado se `RD-05b` for aprovado e implementado.
- **Critério de aceite:** toggle de curtida é idempotente (chamar duas vezes não duplica); se a extensão de anonimato existir, leitura de feed nunca vaza `autor_id` de post anônimo de terceiro (coberto por teste adversarial, não só teste feliz).
- **Paralelizável com:** RD-10, RD-12, RD-13, RD-14.

### RD-12 — Serviço: amizades e bloqueios

- **Escopo:** MVP.
- **Depende de:** RD-04, RD-09
- **Arquivos:** novo `lib/rede/social.ts`
- **O que faz:** enviar/aceitar/recusar pedido de amizade; bloquear/desbloquear.
- **Critério de aceite:** enviar pedido para quem já tem pedido pendente no sentido inverso deveria (decisão de produto a confirmar) virar aceite automático ou erro — documentar a escolha feita no código com um comentário curto, já que `BETA_DOMAIN_MODEL.md` não resolve esse caso de borda.
- **Paralelizável com:** RD-10, RD-11, RD-13, RD-14.

### RD-13 — Serviço: conversas e mensagens

- **Escopo:** MVP.
- **Depende de:** RD-06, RD-09
- **Arquivos:** novo `lib/rede/mensagens.ts`
- **O que faz:** criar/buscar conversa 1:1, enviar mensagem, marcar como lida, helper de `subscribe` ao canal Realtime da conversa.
- **Critério de aceite:** abrir a mesma conversa duas vezes (mesmo par de usuários) reaproveita a conversa existente em vez de criar duplicata.
- **Paralelizável com:** RD-10, RD-11, RD-12, RD-14.

### RD-14 — Serviço: denúncias e admin

- **Escopo:** MVP.
- **Depende de:** RD-07, RD-09
- **Arquivos:** novo `lib/rede/denuncias.ts`, novo `lib/rede/admin.ts`
- **O que faz:** criar denúncia; `isAdmin(userId)`; listar/atualizar status de denúncias (só para admin).
- **Critério de aceite:** chamada de atualização de status por usuário não-admin falha (a RLS já garante isso — o teste é confirmar que o serviço não tenta contornar via service role sem necessidade).
- **Paralelizável com:** RD-10, RD-11, RD-12, RD-13.

### RD-15 — Endpoint: gerar/resgatar convite

- **Escopo:** MVP.
- **Depende de:** RD-01, RD-09
- **Arquivos:** novo `app/api/rede/convites/route.ts`
- **O que faz:** `POST` para admin gerar convite (usa `supabaseAdmin`, operação privilegiada — mesmo padrão de `app/api/cron/notificacoes/route.ts`; código gerado com entropia suficiente, armazenado como hash); endpoint (ou a mesma rota) para resgatar um código em texto puro, comparar contra o hash e vincular a `usado_por` de forma atômica.
- **Critério de aceite (endurecido nesta revisão):**
  - geração exige ser admin (checa `rede_admins` antes de usar service role);
  - código nunca é armazenado em texto puro no banco (só hash);
  - resgate falha para código já usado ou expirado;
  - resgate é atômico — teste de concorrência (`RD-19`) prova que dois resgates simultâneos do mesmo código não passam os dois;
  - endpoint de resgate tem rate limit;
  - nenhum log da aplicação registra o código completo (só forma truncada/hash).
- **Paralelizável com:** RD-16.

### RD-16 — Endpoint: solicitar beta

- **Escopo:** MVP.
- **Depende de:** RD-01, RD-09
- **Arquivos:** novo `app/api/rede/solicitar-beta/route.ts`
- **O que faz:** endpoint que o botão "Quero participar da beta" (hoje só UI estática em `components/rede/RedeTeaserTab.tsx`, fora do escopo deste agente) vai poder chamar quando ganhar integração — cria a linha em `rede_solicitacoes_beta` para o usuário autenticado.
- **Critério de aceite:** chamada duplicada do mesmo usuário não cria duas solicitações (`UNIQUE(user_id)` já impede na migration RD-01, endpoint só precisa tratar o erro com uma resposta clara).
- **Paralelizável com:** RD-15.
- **Nota de integração:** este ticket entrega só o endpoint. Conectar o botão existente ao endpoint é trabalho em `components/rede/RedeTeaserTab.tsx`, arquivo fora do mandato deste agente — fica registrado aqui como o ponto de handoff para quem tiver acesso ao frontend da Rede.

### RD-17 — Harness de testes local/staging

- **Escopo:** MVP (pré-requisito de qualidade). Adicionado nesta revisão a pedido do Codex.
- **Depende de:** RD-000
- **Arquivos:** novo diretório de testes (ex.: `tests/rede/` ou equivalente ao padrão de teste que o projeto adotar — hoje não há suíte automatizada, então este ticket também decide/documenta a ferramenta escolhida), configuração de ambiente local/staging do Supabase para rodar contra ele (nunca produção).
- **O que faz:** monta a infraestrutura mínima para rodar testes de RLS/concorrência contra um Supabase local (CLI `supabase start`) ou staging dedicado, com múltiplos usuários de teste.
- **Critério de aceite:** é possível criar 2+ usuários de teste, autenticar como cada um, e rodar uma asserção de RLS de ponta a ponta contra um ambiente que não é produção.
- **Paralelizável:** não — pré-requisito de `RD-18`, `RD-19`, `RD-20`.

### RD-18 — Testes automatizados de RLS multiusuário

- **Escopo:** MVP.
- **Depende de:** RD-17, e de cada migration que for testada (RD-01, RD-02, RD-04, RD-05, RD-06, RD-07)
- **Arquivos:** novos arquivos de teste cobrindo cada tabela da seção 2 de `SUPABASE_MIGRATION_PLAN.md`.
- **O que faz:** substitui a verificação manual ("testar com 2 contas") citada nos critérios de aceite das migrations por suítes automatizadas — cada policy tem pelo menos um teste que prova o caso permitido e um que prova o caso negado (ex.: usuário A não lê solicitação de B; usuário bloqueado não aparece no feed de quem bloqueou; não-participante não lê mensagens da conversa).
- **Critério de aceite:** suíte roda em CI (ou pelo menos localmente de forma repetível) e falha se qualquer policy regredir.
- **Paralelizável:** cresce incrementalmente conforme cada migration MVP é criada, mas pode ser iniciado assim que `RD-17` e `RD-01` existirem.

### RD-19 — Testes de concorrência

- **Escopo:** MVP.
- **Depende de:** RD-17, RD-04 (amizades), RD-05 (curtidas), RD-13 (conversa única), RD-15 (convites)
- **Arquivos:** novos testes de concorrência.
- **O que faz:** dispara operações simultâneas contra os pontos identificados como sensíveis a corrida: resgate do mesmo código de convite duas vezes ao mesmo tempo; pedido de amizade duplicado enviado nos dois sentidos simultaneamente; curtida disparada em paralelo pelo mesmo usuário no mesmo post; duas tentativas simultâneas de abrir a "mesma" conversa 1:1 entre o mesmo par de usuários.
- **Critério de aceite:** nenhum dos cenários acima produz estado duplicado ou inconsistente — as constraints (`UNIQUE`, PK composta, transação atômica) seguram a corrida.
- **Paralelizável com:** RD-18 (depois que as dependências de cada um estiverem prontas).

### RD-20 — Testes de rotas sem service role no client

- **Escopo:** MVP.
- **Depende de:** RD-15, RD-16
- **Arquivos:** novos testes/lint contra `app/api/rede/*` e qualquer código client-side.
- **O que faz:** garante que `supabaseAdmin`/service role só é importado e usado em código server-side (Route Handlers), nunca em componente client (`"use client"`) nem em código que possa acabar em bundle de browser — e que rotas que usam service role exigem checagem de autorização (admin) antes de qualquer operação privilegiada.
- **Critério de aceite:** teste (ou regra de lint) que falha se `lib/supabaseAdmin.ts` for importado fora de arquivos server-only; teste que prova que chamar as rotas de `RD-15` sem ser admin retorna erro de autorização, não executa a operação privilegiada.

## Tickets que podem rodar em paralelo (resumo)

- RD-03 (fora do MVP) e RD-04 (depois de RD-02)
- RD-05 e RD-06 (depois de RD-04)
- RD-07 e RD-08 (fora do MVP) (depois de suas dependências)
- RD-10, RD-11 (núcleo), RD-12, RD-13, RD-14 (depois de RD-09)
- RD-15 e RD-16 (depois de RD-01 e RD-09)
- RD-18 e RD-19 (depois de RD-17 e das migrations que cada um cobre)

Tudo antes de RD-01 (ou seja, RD-000 → RD-00) e RD-01→RD-02 são estritamente sequenciais — são a fundação de acesso de que todo o resto depende. `RD-05b`, `RD-03` e `RD-08` são propostas fora do MVP e não devem bloquear a entrega do beta mínimo.
