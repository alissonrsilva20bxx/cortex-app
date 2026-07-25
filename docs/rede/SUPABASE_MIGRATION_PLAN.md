# Plano de Migrations Futuras — Rede

**Data:** 2026-07-25
**Status:** planejamento. Nenhuma migration real foi criada ou executada por este agente — nenhum arquivo em `supabase/migrations/` foi tocado, nenhum SQL foi rodado contra o Supabase remoto.

Este documento assume o modelo de domínio descrito em `BETA_DOMAIN_MODEL.md` e o estado atual descrito em `CURRENT_BACKEND_AUDIT.md`. Antes de tudo, ele trata de um problema que a auditoria encontrou: **há indícios de que o histórico de migrations está incompleto hoje**, e isso precisa ser confirmado e corrigido antes de empilhar mais schema em cima.

Este plano cobre o schema completo proposto em `BETA_DOMAIN_MODEL.md`, incluindo peças marcadas como fora do MVP (ex.: `rede_assinaturas`, Storage de mídia). Migrations correspondentes a peças fora do MVP (`0007`, `0012`) não bloqueiam o lançamento do beta mínimo — ver `BETA_DOMAIN_MODEL.md` §0 para o que é núcleo vs. proposta.

---

## 0a. Pré-requisito: auditoria remota somente leitura (antes de qualquer baseline)

A auditoria encontrou indícios — **não confirmação** — de que 3 tabelas (`despesas`, `receitas_avulsas`, `objetivos`) e ao menos 1 alteração de enum (`tema`, de 3 para 8 valores) existem no banco remoto sem migration numerada correspondente em `supabase/migrations/`. Esses indícios vêm de um snapshot (`lib/database.types.ts`) e de scripts soltos — **não são uma leitura do estado atual do Supabase**.

**Corrigido nesta revisão (a pedido do Codex):** não é seguro ir direto para uma migration de "correção de baseline" a partir de indícios. `CREATE TABLE IF NOT EXISTS` não reconcilia divergências reais — se uma coluna, constraint, trigger ou policy no remoto for diferente do que o script local assume, `IF NOT EXISTS` simplesmente não faz nada e a divergência de detalhe continua invisível.

**Novo ticket, anterior a `RD-00`** (ver `BACKEND_TICKETS.md`, ticket `RD-000`): auditoria remota somente leitura —

- Extrair o schema atual de verdade do Supabase remoto agora (dump de schema, `information_schema`/`\d+` de cada tabela relevante, ou `supabase db dump`/`supabase gen types` rodado *hoje*, não reaproveitando o snapshot antigo).
- Comparar essa extração com `supabase/migrations/*.sql` e com os scripts soltos, tabela por tabela: colunas, tipos, constraints, defaults, triggers, policies, valores de enum.
- Produzir um diff explícito e documentado antes de escrever qualquer migration de correção.
- Ensaiar a migration de correção (seção 0b) num **banco descartável** que replique o schema real extraído — nunca a primeira execução direto no remoto de produção.

Só depois desse diff confirmado é que faz sentido escrever a migration de correção. A seção abaixo descreve o que ela provavelmente precisa cobrir, mas fica **condicionada ao resultado desta auditoria**, não é um plano fechado.

## 0b. Migration de correção de baseline (condicionada à auditoria remota da seção 0a)

**Só executar depois que o diff da seção 0a confirmar exatamente o que precisa ser reconciliado.** Com base nos indícios atuais, a migration de correção provavelmente precisa:

- Recriar as 3 tabelas (`despesas`, `receitas_avulsas`, `objetivos`) e o `ALTER TYPE` do enum `tema` — mas usando exatamente as definições confirmadas pelo diff remoto, não assumindo que os scripts soltos em `supabase/*.sql` ainda batem 100% com o remoto.
- Ser escrita para ser seguramente re-executável (`IF NOT EXISTS` / blocos `DO $$ ... $$` com checagem antes de `ADD VALUE` no enum) **como proteção adicional**, não como substituto da reconciliação real feita a partir do diff.
- Ser testada primeiro no banco descartável da auditoria (seção 0a), e só depois considerada para o remoto real.
- Ticket correspondente: `BACKEND_TICKETS.md`, ticket `RD-00` (agora depende de `RD-000`).

Sem os dois passos (auditoria + correção condicionada), cada migration nova da Rede carrega a mesma dívida silenciosa adiante.

## 1. Sequência proposta

Numeração contínua a partir de `0004` (assumindo que a correção acima vira `0004`; migrations da Rede começam em `0005`). Cada uma é aditiva — nenhuma altera ou remove tabelas do JobApp base (`jobs`, `metas`, `notas`, `configuracoes`, `despesas`, `receitas_avulsas`, `objetivos`, `push_subscriptions`).

| # | Migration | Escopo | Tabelas/objetos | Depende de |
|---|---|---|---|---|
| 0005 | `rede_beta_gating` | MVP | `rede_solicitacoes_beta`, `rede_convites`, `rede_admins` | Só `auth.users` |
| 0006 | `rede_perfis` | MVP | `rede_perfis`, `rede_livelinks` | 0005 (RLS de perfil consulta convite resgatado) |
| 0007 | `rede_assinaturas` | **Fora do MVP — proposta** | `rede_assinaturas` | 0006 |
| 0008 | `rede_social_graph` | MVP | `rede_amizades`, `rede_bloqueios` | 0006 |
| 0009 | `rede_conteudo` | MVP (texto; anônimo é add-on separado, ver 0009b) | `rede_posts`, `rede_comentarios`, `rede_curtidas` | 0006, 0008 (RLS de posts precisa checar bloqueios) |
| 0009b | `rede_posts_anonimos` | **Fora do MVP — proposta a validar** | view/função de ocultação de `autor_id` | 0009 |
| 0010 | `rede_mensageria` | MVP (texto) | `rede_conversas`, `rede_conversas_participantes`, `rede_mensagens` + habilitar Realtime | 0006, 0008 |
| 0011 | `rede_denuncias` | MVP (fila mínima) | `rede_denuncias` | 0005 (moderação usa `rede_admins`), 0009, 0010 (denuncia aponta pra post/comentário/mensagem) |
| 0012 | `rede_storage` | **Fora do MVP — proposta** | bucket `rede-midia` + policies | 0006, 0009 (paths usam `user_id` e `post_id`) |

Justificativa da ordem: gating de beta primeiro (senão não há como restringir quem pode ter perfil), perfil antes de qualquer coisa social (tudo referencia autor/dono), grafo social (amizade/bloqueio) antes de conteúdo (porque a RLS de posts e mensagens precisa consultar bloqueios desde o dia 1 — não dá pra adicionar a regra de bloqueio depois sem reescrever policy já em produção), denúncia por último porque é polimórfica e referencia várias das tabelas anteriores.

## 2. RLS necessária por tabela

Princípio geral herdado do projeto atual: **toda tabela nova tem RLS habilitada na mesma migration que a cria** — nunca criar tabela e adicionar RLS depois numa migration separada (janela de exposição).

- **`rede_solicitacoes_beta`**: dono vê/cria a própria solicitação (`user_id = auth.uid()`); sem `SELECT` de outras solicitações.
- **`rede_convites`**: `SELECT` só para quem tem `usado_por = auth.uid()` ou é admin (`rede_admins`); ninguém além de admin faz `INSERT`/`UPDATE` (via service role — não é operação de client).
- **`rede_admins`**: só leitura, só pelo próprio admin verificar se é admin; sem `INSERT`/`UPDATE`/`DELETE` via client (gerência manual/service role).
- **`rede_perfis`**: `SELECT` para qualquer autenticado com convite resgatado (subquery em `rede_convites`); `INSERT`/`UPDATE`/`DELETE` só do próprio dono, condicionado a ter convite resgatado.
- **`rede_livelinks`**: `SELECT` igual ao perfil (aberto a membros); escrita só do dono.
- **`rede_amizades`**: linhas visíveis/gerenciáveis só por `solicitante_id` ou `destinatario_id` igual a `auth.uid()`.
- **`rede_bloqueios`**: só o próprio `bloqueador_id` vê/gerencia seus bloqueios (o bloqueado não sabe que foi bloqueado — isso é intencional, não expor a lista para o alvo).
- **`rede_posts`** / **`rede_comentarios`**: `SELECT` para membros, **excluindo** linhas cujo `autor_id` está numa relação de bloqueio (nos dois sentidos) com `auth.uid()` — a policy precisa de um `NOT EXISTS (SELECT 1 FROM rede_bloqueios WHERE ...)`. Escrita só do dono.
- **`rede_curtidas`**: `INSERT`/`DELETE` só onde `user_id = auth.uid()`; `SELECT` aberto (contagem pública entre membros).
- **`rede_conversas` / `rede_conversas_participantes` / `rede_mensagens`**: só participantes da conversa (via `EXISTS` em `rede_conversas_participantes`) enxergam ou escrevem. Bloqueio mútuo impede criar conversa nova (checar na aplicação e reforçar com `CHECK`/trigger, já que RLS de `INSERT` não consegue facilmente "olhar" a outra ponta sem uma função auxiliar).
- **`rede_denuncias`**: denunciante vê a própria denúncia; só admin (`rede_admins`) vê todas e atualiza `status`.
- **`rede_assinaturas`** (fora do MVP): `SELECT` só do dono; `INSERT`/`UPDATE`/`DELETE` **nunca pelo client autenticado** — só service role/webhook server-side. Não replicar o padrão `FOR ALL` de `configuracoes` aqui — ver bloqueador crítico corrigido em `BETA_DOMAIN_MODEL.md` §9 e o risco equivalente já existente hoje em `CURRENT_BACKEND_AUDIT.md` §9, item 8.

**Nota de segurança adicional (Codex):** qualquer policy que consulta outra tabela dentro de si mesma (ex.: `rede_perfis` consultando `rede_convites`, `rede_posts`/`rede_mensagens` consultando `rede_bloqueios`/`rede_conversas_participantes`, qualquer coisa consultando `rede_admins`) precisa ser desenhada explicitamente contra recursão — RLS pode entrar em custo inesperado (ou, em desenhos mal feitos, em ciclo) se uma policy dispara avaliação de RLS de outra tabela que, por sua vez, depende da primeira. Preferir funções auxiliares `SECURITY DEFINER` simples e testadas (com `search_path` fixo e grants mínimos) para essas checagens, em vez de subqueries diretas nas policies quando a relação for circular ou profunda. Toda função auxiliar dessas precisa de teste adversarial (tentar contornar a checagem, não só o caminho feliz) antes de entrar em produção — ver `BACKEND_TICKETS.md`, ticket `RD-18`.

## 3. Índices

- `rede_posts (autor_id, criado_em desc)` — feed ordenado por autor e por tempo é o padrão de acesso óbvio (mesma lógica do índice existente `jobs_user_data_idx`).
- `rede_posts (categoria)` — se o feed ganhar filtro por categoria (o teaser já mostra categorias como conceito de UI).
- `rede_comentarios (post_id, criado_em)` — carregar comentários de um post em ordem.
- `rede_curtidas (post_id)` — contagem rápida de curtidas por post (a PK composta `(post_id, user_id)` já cobre isso como índice líder).
- `rede_amizades (solicitante_id)` e `(destinatario_id)` — dois índices, já que a tabela é consultada nos dois sentidos ("minhas solicitações enviadas" vs "recebidas").
- `rede_bloqueios (bloqueador_id)` — consulta mais frequente é "quem eu bloqueei" (para filtrar feed); índice em `bloqueado_id` só se houver necessidade de consulta reversa.
- `rede_conversas_participantes (user_id)` — "minhas conversas".
- `rede_mensagens (conversa_id, criado_em)` — histórico de uma conversa em ordem cronológica.
- `rede_denuncias (status)` — fila de moderação filtra por pendente.

## 4. Realtime

Hoje **nenhuma tabela do projeto usa Supabase Realtime** (confirmado na auditoria — zero `supabase.channel(...)` no código). A Rede introduz o primeiro caso de uso legítimo:

- **`rede_mensagens`**: candidata natural — conversa privada precisa aparecer sem reload. Habilitar Realtime (`ALTER PUBLICATION supabase_realtime ADD TABLE rede_mensagens`) na migration 0010, escopado por RLS (Realtime respeita RLS da tabela, então um participante só recebe eventos de conversas onde está listado em `rede_conversas_participantes`).
- **`rede_curtidas` / `rede_comentarios`** (contagem ao vivo no feed): **não habilitar na v1** — é otimização de UX, não requisito confirmado pelo teaser, e cada tabela extra em Realtime tem custo de infra. Registrar como possível ticket futuro, não pré-requisito.
- Nada de Realtime em `rede_posts` diretamente (feed novo aparecendo ao vivo) na v1 pelo mesmo motivo — refresh manual/pull-to-refresh é suficiente para lançamento.
- **Correção desta revisão (Codex):** Realtime + RLS não é garantia por padrão. Antes de contar com isso em produção, validar com duas sessões reais (dois usuários de teste, dois clients conectados) que um participante recebe eventos só das conversas onde está listado, e escrever um teste automatizado que reproduza esse cenário (`BACKEND_TICKETS.md`, ticket `RD-18`/`RD-19`) — não assumir que a RLS da tabela é suficiente só porque a documentação do Supabase diz que Realtime respeita RLS. Se essa validação não estiver pronta a tempo do lançamento, o chat do MVP pode rodar com polling simples e Realtime entra depois.

## 5. Storage

**Escopo:** fora do MVP — proposta, ver `BETA_DOMAIN_MODEL.md` §0. O beta mínimo é texto puro.

- Novo bucket **`rede-midia`** (privado por padrão na criação, mas com policy de leitura mais aberta que o `cofre` — o `cofre` é 100% privado por dono, `rede-midia` precisa ser legível por outros membros para imagens de post/perfil aparecerem no feed de terceiros).
- Convenção de path proposta, espelhando o padrão já usado no `cofre` (`{user_id}/{categoria}/{filename}`): `{user_id}/posts/{post_id}/{filename}` e `{user_id}/perfil/{filename}` (para eventual foto de perfil, hoje fora de escopo — perfil v1 usa só cor+iniciais).
- Policy: `INSERT` só do dono do path (mesmo padrão de `auth.uid()::text = split_part(name,'/',1)` já usado no `cofre`); `SELECT` aberto a qualquer membro autenticado da Rede (não signed-URL-only como o Cofre, já que o propósito aqui é exibição pública dentro da comunidade, não sigilo).
- **A decidir (produto):** limite de tamanho por arquivo e formatos aceitos — o ADR do Cofre já sugere 10 MB como teto razoável por analogia; replicar esse número é uma proposta razoável, não uma certeza de produto.

## 6. Rollback

**Correção desta revisão (a pedido do Codex):** a versão anterior tratava `DROP TABLE ... CASCADE` como estratégia padrão e "sem efeito colateral". Isso está errado — `CASCADE` por definição tem efeito colateral (apaga tudo que referencia a tabela), e tratar isso como padrão convida a apagar dado real sem querer. A estratégia correta:

- **Preferir roll-forward a rollback.** Se uma migration da Rede tiver um problema, o primeiro instinto deveria ser escrever uma migration nova que corrige o problema (ex.: ajustar uma policy, adicionar uma coluna faltante), não reverter a anterior. Rollback via `DROP` é o último recurso, não o padrão.
- **Reversão explícita por objeto, não `CASCADE` genérico.** Cada migration precisa documentar, no próprio ticket, a lista exata de objetos que criou (tabelas, policies, índices, triggers, entradas de `ALTER PUBLICATION`, buckets e policies de Storage) e como desfazer **cada um individualmente** se for realmente necessário — não delegar isso a `CASCADE` decidir por conta própria o que mais apagar.
- **Nunca apagar dado real do beta automaticamente.** Mesmo em fase de beta fechado, qualquer rollback que remova linhas de tabela precisa ser uma ação manual, revisada por humano, nunca um script que roda `DROP` sem confirmação explícita de que não há dado que importa naquela tabela naquele momento.
- **Exigir backup/export antes de qualquer mudança destrutiva.** Antes de rodar qualquer `DROP`/`TRUNCATE`/`ALTER` que remova dado ou coluna, exportar (ou confirmar snapshot/backup do Supabase) daquela tabela primeiro. Isso vale mesmo em beta — não custa caro e evita perda irreversível.
- **Rollback de RLS/policies:** desfazer uma policy é `DROP POLICY`, não `DROP TABLE` — normalmente reversível sem risco de dado, mas ainda assim documentar qual policy substitui qual.
- **Rollback de Realtime:** `ALTER PUBLICATION supabase_realtime DROP TABLE rede_mensagens` — trivial e sem risco de dado, mas precisa ser lembrado explicitamente (é fácil esquecer que uma tabela ficou publicada).
- **Rollback de Storage:** bucket e suas policies não são revertidos pelo mesmo mecanismo de `DROP TABLE` — remover um bucket com arquivos dentro é uma operação distinta (e mais perigosa, porque apaga arquivo de usuário) do que remover uma tabela vazia. Tratar como categoria de risco própria, nunca assumir que "reverter a migration" também limpa o bucket com segurança.
- **Ordem, quando uma reversão for mesmo necessária:** reversa da ordem de aplicação (seção 1), por causa de FKs — mas cada passo dessa reversão é uma decisão própria, revisada, não um `CASCADE` disparado de uma vez.
- Migration de correção de baseline (seção 0b): sendo idempotente por construção, normalmente não precisa de rollback — mas isso só é seguro **depois** que o diff da auditoria remota (seção 0a) confirmar que ela não está sobrescrevendo nada inesperado.

## 7. Processo recomendado daqui pra frente

- Parar de rodar SQL solto direto no SQL Editor do Supabase para qualquer tabela nova — é exatamente o hábito que causou a divergência descrita na seção 0. Toda mudança de schema, inclusive as pequenas, vira arquivo em `supabase/migrations/` primeiro.
- Cada migration da lista acima é candidata a **um PR/ticket próprio** (ver `BACKEND_TICKETS.md`) — não fazer uma migration gigante com todas as 8 tabelas de uma vez, tanto por revisão quanto porque falhas de RLS são mais fáceis de detectar tabela por tabela.
- Gerar/atualizar `lib/database.types.ts` sempre contra um ambiente **local ou staging** primeiro, nunca produção como primeiro passo — produção só depois de validado. Evita que um `gen types` malfeito ou uma migration com problema vaze schema errado direto para o código que todo o app usa (ver `BACKEND_TICKETS.md`, ticket `RD-09`).
