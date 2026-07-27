# Modelo de Domínio — Rede (Beta)

**Data:** 2026-07-25
**Status:** proposta técnica, para revisão do ChatGPT/Codex e do produto. Nada aqui foi implementado — é modelagem, não migration.

## Como ler este documento

Cada entidade tem duas seções: **Confirmado pelo produto** (o que já está decidido, evidenciado em `components/rede/RedeTeaserTab.tsx` e nos ADRs/CONTEXT.md existentes) e **Proposta técnica** (decisões de modelagem que este agente sugere para preencher as lacunas, e que precisam de validação humana antes de virar migration). Onde a proposta é uma decisão de produto disfarçada de decisão técnica (limites numéricos, regras de negócio), isso é marcado explicitamente como **a decidir**.

Convenções herdadas do restante do projeto (ver `MASTER_PROMPT.md`): tabelas e colunas em `snake_case`, mapeadas para `camelCase` no app; toda tabela de dado de usuário tem RLS por dono; PKs são `uuid default gen_random_uuid()`.

---

## 0. Escopo do Beta Mínimo (MVP)

Adicionado nesta revisão (a pedido de `CODEX_REVIEW.md`). Cada seção abaixo tem uma linha **Escopo** indicando se é núcleo do beta mínimo (bloqueia o lançamento se faltar) ou proposta futura (não bloqueia, decide-se depois).

**Dentro do MVP:**
- Perfil (`rede_perfis`) e LiveLinks — sem foto real, só cor+iniciais.
- Feed de **texto** — posts e comentários **não-anônimos**, sem imagem.
- Curtidas e comentários.
- Amizades (pedido → aceite).
- Chat 1:1 de **texto**.
- Bloqueio.
- Denúncia — fila mínima (registrar a denúncia e permitir que um admin marque como revisada; não exige workflow de moderação completo).
- Convite beta (lista de espera + resgate de convite) — é o portão de entrada, não dá pra lançar sem isso.

**Fora do MVP — proposta a validar com o produto, não bloqueia lançamento:**
- Posts e comentários anônimos (seções 3 e 4).
- Imagens e bucket de mídia `rede-midia` (fora do texto puro).
- Categorias de post além do mínimo necessário para o feed funcionar.
- Assinatura/plano separado da Rede (`rede_assinaturas`) — o MVP pode rodar em beta fechado sem gate de billing próprio; decisão de produto em aberto.
- Moderação/admin completa (além da fila mínima de denúncias).
- SSR/SEO do feed.
- Endpoints além do estritamente necessário para o acesso beta mínimo (convite + solicitar beta).

---

## 1. Perfil Público

**Escopo:** dentro do MVP.

**Confirmado:** todo membro da Rede tem um perfil visível aos outros membros (não ao público geral da internet — o teaser fala em "comunidade **privada**"). O perfil usa avatar por iniciais sobre cor sólida, igual ao padrão já usado em `components/rede/Avatar.tsx` — sem foto real na v1 (mesma filosofia do resto do app: "nunca depende de foto real", conforme comentário no próprio componente).

**Proposta técnica:**

- Tabela `rede_perfis`, 1:1 com `auth.users` (mesmo padrão de `configuracoes`): `user_id` como PK/FK.
- Campos: `nome_exibicao`, `bio` (texto curto), `cor_avatar` (reaproveita o esquema de cor sólida do `Avatar.tsx`), `area_atuacao` (texto livre ou categoria — mesmo domínio profissional do JobApp: autônomas), `criado_em`, `atualizado_em`.
- **Perfil é opt-in explícito**: existir em `rede_perfis` = ter entrado na Rede. Sem linha nessa tabela, o usuário não aparece pra ninguém (mesmo princípio do `push_subscriptions`: existência da linha é o opt-in, sem coluna de flag separada).
- **A decidir (produto):** o perfil da Rede é visível para *todo* membro autenticado da Rede, ou existe algum filtro de visibilidade (ex.: só depois de virar "amiga")? O teaser sugere feed aberto a todos os membros, então a proposta default é: perfil e posts públicos dentro da comunidade, amizade é sobre criar conexão/DM, não sobre desbloquear visibilidade.

## 2. LiveLinks

**Escopo:** dentro do MVP.

**Confirmado:** o teaser promete "Perfil: LiveLinks e vitrine pública, do seu jeito" — links configuráveis no perfil, no estilo Linktree.

**Proposta técnica:**

- Tabela `rede_livelinks`: `id`, `user_id` (FK), `titulo`, `url`, `ordem` (inteiro, para permitir reordenar), `criado_em`.
- RLS: dono tem CRUD total nos próprios links; qualquer membro autenticado da Rede pode `SELECT` os links de qualquer perfil (é vitrine pública dentro da comunidade).
- Validação de URL (schema `https://`, tamanho máximo) fica na aplicação, não no banco — mesmo padrão do resto do projeto (constraints de banco são simples: `CHECK` de not-null/positivo, validação de formato é client-side).
- **Limites técnicos do MVP:** após remover espaços externos, o título deve ter de 1 a 100 caracteres e a URL HTTPS absoluta deve ter no máximo 2048 caracteres. Esses valores ficam centralizados e exportados pela camada de serviço.
- **A decidir (produto):** limite de quantidade de LiveLinks por perfil. Sugestão por analogia ao limite já existente no Cofre (15 imagens) seria um número pequeno e fixo (ex.: 5) para manter o perfil "vitrine", não uma lista infinita — mas isso é call de produto, não técnica.

## 3. Posts

**Escopo:** núcleo (texto, categoria, autor visível) dentro do MVP. **Anonimato é proposta a validar, fora do MVP** — não bloqueia o lançamento.

**Confirmado:** feed com posts categorizados — o teaser mostra as categorias **"Conquista"** e **"Dica"** com cores distintas por categoria. Cada post tem autor (nome + avatar colorido), texto, tempo relativo, contagem de curtidas e comentários.

**Correção desta revisão:** a versão anterior deste documento afirmava que "posts anônimos são requisito de produto confirmado" com base em `Avatar.tsx` ter um modo `anonimo`. Isso estava errado — **`Avatar.tsx` suportar um modo visual `anonimo` é capacidade de componente, não decisão de produto confirmada**. Nada no teaser, no `CONTEXT.md` ou nos ADRs confirma que posts/comentários anônimos vão existir de fato. Tratado abaixo como proposta a validar, não como requisito.

**Proposta técnica (núcleo, dentro do MVP):**

- Tabela `rede_posts`: `id`, `autor_id` (FK `auth.users`, sempre visível no MVP), `categoria` (enum — sugestão inicial: `conquista`, `dica`, `duvida`, `desabafo`, ver "a decidir" abaixo), `texto`, `criado_em`, `atualizado_em`.
- RLS: `SELECT` para qualquer membro com perfil em `rede_perfis` (respeitando bloqueios — ver seção 6); `INSERT`/`UPDATE`/`DELETE` só pelo dono (`autor_id = auth.uid()`).
- **A decidir (produto):** lista fechada de categorias (enum Postgres) vs. tags livres. Enum é mais simples e íntegro com o padrão do resto do schema (`job_status`, `modalidade` já são enums), mas trava a evolução sem migration. Sugestão: começar com enum fixo (`conquista`, `dica`, `duvida`, `desabafo`) dado que só 2 categorias já apareceram no teaser e o app inteiro já segue esse padrão.

**Proposta a validar (fora do MVP): posts anônimos.**

- Se o produto confirmar essa necessidade, adicionar `anonimo` (boolean) e `imagem_url` (nullable, bucket novo de Storage) a `rede_posts`.
- `autor_id` continuaria **nunca nulo** — anonimato seria só de exibição; o sistema sempre sabe quem postou, necessário para moderação/denúncia.
- Esconder uma coluna exige mais do que RLS de linha (RLS não esconde colunas). Se aprovado, a leitura de posts anônimos por terceiros precisa vir de uma `view` ou função `security definer` dedicada, **nunca acesso direto de terceiros à tabela base** — com: acesso à tabela base revogado para o role usado pelo client (só a view/função tem `SELECT`), grants mínimos na função (`security definer` com o menor privilégio possível, não superuser), `search_path` fixado explicitamente na função (evita sequestro de função por schema malicioso), e testes automatizados que provem que nenhuma consulta (incluindo via `join`) vaza `autor_id` de post anônimo de terceiro para quem não é o dono nem admin.
- Enquanto não aprovado, **não modelar isso como bloqueador de nenhum ticket do MVP**.

## 4. Comentários e Curtidas

**Escopo:** núcleo (comentário e curtida não-anônimos) dentro do MVP. **Comentário anônimo é proposta adicional a validar, fora do MVP.**

**Confirmado:** cada post mostra contagem de curtidas (❤) e comentários (💬) — não há evidência no teaser de curtidas/comentários em comentários (nested), nem de reações além de curtida simples.

**Proposta técnica (núcleo, dentro do MVP):**

- Tabela `rede_comentarios`: `id`, `post_id` (FK), `autor_id` (FK, sempre visível no MVP), `texto`, `criado_em`.
- Tabela `rede_curtidas`: `post_id` (FK), `user_id` (FK), `criado_em`, PK composta `(post_id, user_id)` — impede curtida duplicada por construção, sem precisar de `UNIQUE` extra.
- RLS de `rede_curtidas`: `INSERT`/`DELETE` só onde `user_id = auth.uid()`; `SELECT` aberto a membros (para contar/mostrar quem curtiu, se o produto quiser essa feature depois).
- **Fora do escopo v1 (a decidir se entra depois):** curtida em comentário. Não há evidência de produto para isso ainda; não modelar agora para não especular.

**Proposta a validar (fora do MVP): comentário anônimo.**

- Se `anonimo` for aprovado para posts (seção 3), a mesma decisão **não se estende automaticamente** a comentários — é uma proposta separada, com o mesmo requisito de hardening (view/função dedicada, sem acesso direto à tabela base) se aprovada. Tratar como decisão de produto independente, não como consequência automática da decisão de posts.

## 5. Amizades

**Escopo:** dentro do MVP.

**Confirmado:** o teaser chama essa feature de **"Amigas"** — "Conecte-se com outras profissionais". A palavra escolhida ("Amigas", não "Seguir") sugere relação **bidirecional e consentida** (pedido → aceite), como Facebook, não relação assimétrica tipo "seguir" do Instagram/Twitter.

**Proposta técnica:**

- Tabela `rede_amizades`: `id`, `solicitante_id` (FK), `destinatario_id` (FK), `status` (enum: `pendente`, `aceita`, `recusada`), `criado_em`, `respondido_em` (nullable).
- Restrição de par único independente da ordem: `CHECK (solicitante_id <> destinatario_id)` + índice único sobre `(least(solicitante_id, destinatario_id), greatest(solicitante_id, destinatario_id))` — evita pedido duplicado nos dois sentidos.
- RLS: cada usuário só enxerga/gerencia linhas onde é `solicitante_id` ou `destinatario_id`.
- **A decidir (produto):** ser "amiga" é pré-requisito pra mandar mensagem (seção 6), ou qualquer membro pode iniciar DM com qualquer outro? Isso muda a RLS de `rede_conversas`. Sugestão pela linguagem do teaser ("Amigas" e "Conversas" aparecem como dois blocos separados, não um dependente do outro) é permitir DM aberto entre membros, com bloqueio como a válvula de escape — mas é decisão de produto, não técnica.

## 6. Conversas e Mensagens

**Escopo:** chat 1:1 de texto dentro do MVP. Realtime é a proposta de melhor UX, mas não é estritamente obrigatório para o lançamento (ver nota abaixo).

**Confirmado:** "Conversas: Mensagens privadas, sem sair do app" — mensageria 1:1 dentro do próprio app.

**Proposta técnica:**

- `rede_conversas`: `id`, `criado_em`. (Sem `tipo` na v1 — assume-se 1:1; ver nota de extensibilidade abaixo.)
- `rede_conversas_participantes`: `conversa_id` (FK), `user_id` (FK), PK composta. Modelar como tabela de junção (em vez de `usuario_a_id`/`usuario_b_id` direto em `rede_conversas`) mesmo para 1:1 v1, porque isso evita uma migration de schema inteira no dia em que o produto pedir conversas em grupo — é a única escolha nesta seção que já olha um passo à frente, e é reversível/barata de manter simples agora (uma tabela a mais, zero lógica a mais na v1).
- `rede_mensagens`: `id`, `conversa_id` (FK), `autor_id` (FK), `texto`, `criado_em`, `lida_em` (nullable — só funciona de verdade para 1:1; se virar grupo, precisa virar tabela própria de "leituras").
- RLS: só participantes da conversa (via `rede_conversas_participantes`) podem `SELECT`/`INSERT` em `rede_mensagens` daquela conversa. Essa policy consulta outra tabela — precisa ser desenhada explicitamente contra recursão/custo, ver `SUPABASE_MIGRATION_PLAN.md` §2.
- **Candidata a Supabase Realtime** — seria o primeiro caso de uso real de Realtime em todo o projeto (hoje nenhuma tabela usa). **Correção desta revisão:** Realtime + RLS não é garantia por si só — antes de contar com isso em produção, é preciso validar com duas sessões reais e teste automatizado que um participante só recebe eventos das conversas onde está listado. Se essa validação não estiver pronta a tempo, o chat do MVP pode ser lançado com polling simples e Realtime entra depois como melhoria incremental. Detalhado em `SUPABASE_MIGRATION_PLAN.md` §4.

## 7. Bloqueios e Denúncias

**Escopo:** dentro do MVP (fila mínima de denúncia — registrar e permitir que um admin marque como revisada, não é workflow de moderação completo).

**Confirmado:** nada no teaser fala disso diretamente, mas é pré-requisito de qualquer rede social com conteúdo gerado por usuário, e o app já demonstra preocupação com privacidade/segurança em outras áreas (Cofre isolado, PIN, ADRs de segurança). Modelagem necessária mesmo sem menção explícita no teaser.

**Proposta técnica:**

- `rede_bloqueios`: `id`, `bloqueador_id` (FK), `bloqueado_id` (FK), `criado_em`. `UNIQUE(bloqueador_id, bloqueado_id)`.
- Efeito do bloqueio (a implementar via RLS, não só via UI): usuário bloqueado não vê mais posts/perfil/LiveLinks de quem bloqueou, não consegue iniciar conversa nem comentar em posts de quem bloqueou, e vice-versa não aparece mais nas sugestões de amizade. Isso precisa entrar como condição extra em toda policy de `SELECT`/`INSERT` das tabelas de posts, comentários e conversas — não é uma tabela isolada, é uma regra transversal.
- `rede_denuncias`: `id`, `denunciante_id` (FK), `alvo_tipo` (enum: `post`, `comentario`, `usuario`, `mensagem`), `alvo_id` (uuid, sem FK tipada — é polimórfico), `motivo` (enum: `spam`, `assedio`, `conteudo_impropio`, `outro`), `descricao` (texto livre opcional), `status` (enum: `pendente`, `revisada`, `resolvida`), `criado_em`, `revisado_em` (nullable), `revisado_por` (nullable, FK — ver observação abaixo).
- **Lacuna real de produto, não só técnica:** hoje não existe *nenhum* conceito de moderador/admin no JobApp. `revisado_por` pressupõe que alguém tem permissão de revisar denúncias — isso precisa de uma resposta de produto antes de virar migration (ver seção 8, Planos e Permissões).

## 8. Convites Beta

**Escopo:** dentro do MVP — é o portão de entrada, não dá pra lançar sem isso.

**Confirmado:** o teaser já tem um botão "Quero participar da beta" que abre um `BottomSheet` dizendo *"As primeiras vagas serão liberadas aos poucos. Em breve você poderá solicitar seu convite por aqui."* — hoje esse botão **não faz nada no backend** (é só UI estática, confirmado na auditoria). Isso descreve um fluxo de **lista de espera → convite manual/em lotes**, não um convite peer-to-peer (não há menção a "convide uma amiga").

**Proposta técnica — dois conceitos distintos, não um só:**

- `rede_solicitacoes_beta` (a lista de espera — isto é o que o botão do teaser precisa criar no dia em que ganhar backend): `id`, `user_id` (FK, `UNIQUE` — uma solicitação por pessoa), `criado_em`, `status` (enum: `pendente`, `convidado`, `recusado`).
- `rede_convites` (o convite em si, que libera acesso) — **endurecido nesta revisão a pedido do Codex, convite é superfície de abuso**: `id`, `codigo_hash` (hash do código — **nunca armazenar o código em texto puro**, mesmo padrão de senha/token), `solicitacao_id` (FK nullable — um convite pode nascer de uma solicitação da lista de espera, ou ser gerado direto por um admin sem passar pela fila), `usado_por` (FK nullable, preenchido quando alguém resgata), `usado_em` (nullable), `expira_em` (não-nulo — todo convite expira, sem exceção), `criado_em`.
- **Regra de acesso:** ter perfil em `rede_perfis` exige ter um convite resgatado (`rede_convites.usado_por = auth.uid()`) — a UI da Rede (feed, perfil, etc.) só existe para quem passou por esse portão. Isso é o gate de *acesso*, separado do gate de *assinatura paga* (seção 9, fora do MVP).
- **Requisitos de segurança do convite (obrigatórios, não opcionais):**
  - Código gerado com entropia suficiente (token aleatório criptograficamente seguro, não sequencial nem previsível).
  - Resgate **só via rota server-side autenticada** (nunca resolvido só no client) — a rota recebe o código em texto puro, compara o hash, e só então grava `usado_por`.
  - Resgate é uma operação **atômica/transacional**: checar "não usado, não expirado" e marcar como usado precisam ser uma única transação (ou `UPDATE ... WHERE usado_por IS NULL AND expira_em > now()` checando o número de linhas afetadas), para não haver corrida onde dois resgates simultâneos do mesmo código passam os dois.
  - Rate limit no endpoint de resgate, para dificultar força bruta contra o espaço de códigos.
  - Logs de tentativa de resgate **nunca registram o código completo** (só forma truncada/hash, para permitir auditoria sem reexpor o segredo).
- **A decidir (produto):** quem pode gerar convites — só um admin manualmente (mais simples, compatível com "liberadas aos poucos"), ou membros já dentro podem convidar outras pessoas diretamente (peer invite)? O texto do teaser sugere a primeira opção para o lançamento.

## 9. Planos e Permissões

**Escopo:** `rede_assinaturas` (plano separado) é **proposta fora do MVP** — decisão de produto em aberto, não bloqueia o beta. `rede_admins` (allowlist mínima de moderação) é dentro do MVP, só para viabilizar a fila mínima de denúncias (seção 7).

**Confirmado:** o teaser é explícito — *"Rede fará parte do JobApp Rede"*, com *"Plano previsto: R$ 49,90/mês"*. Isso é linguagem de **plano/produto separado** do JobApp base, não uma feature nova incluída na assinatura atual (`configuracoes.assinatura_status`, que hoje é só trial/ativa/vencida do JobApp base — Jobs, Financeiro, Cofre).

### Bloqueador crítico corrigido nesta revisão: assinatura não pode ter escrita pelo próprio usuário

A versão anterior deste documento propunha RLS de `rede_assinaturas` como "dono tem acesso total, mesmo padrão de `configuracoes`". **Isso está errado e foi apontado como bloqueador crítico pelo Codex.** `rede_assinaturas.status` controla acesso comercial — se o dono pudesse escrever nela, qualquer usuário autenticado poderia se autoconceder uma assinatura ativa sem pagar. (Nota relacionada: o padrão atual de `configuracoes` no JobApp base **já tem esse mesmo problema hoje** — RLS `FOR ALL` sem restrição de coluna permite ao dono escrever o próprio `assinatura_status`. Ver `CURRENT_BACKEND_AUDIT.md` §9, item 8. Não é replicado aqui de propósito.)

**RLS correta de `rede_assinaturas`:**

- `SELECT`: só o próprio usuário (`user_id = auth.uid()`) — ele pode consultar o próprio status.
- `INSERT` / `UPDATE` / `DELETE`: **nunca pelo client autenticado.** Só uma rota server-side de confiança (webhook de pagamento, ou endpoint admin), usando service role, pode escrever nessa tabela — sem policy de escrita para o role autenticado, só o service role (que ignora RLS) escreve.
- Toda operação privilegiada de escrita (ex.: "webhook confirmou pagamento, marcar como ativa") precisa ser: **server-side**, **autenticada** (validar a origem do webhook, não confiar em payload não assinado), **idempotente** (reprocessar o mesmo evento de pagamento não deveria duplicar nem corromper o estado), e **auditável** (registrar quem/o quê mudou o status e quando — mesmo que seja só um log, não precisa ser tabela de auditoria completa).
- **Critério de aceite obrigatório para o ticket que implementar isso:** teste automatizado que prove que um cliente autenticado comum, usando só a anon key e a própria sessão, **não consegue** chamar `UPDATE`/`INSERT` em `rede_assinaturas` para se autoativar, reiniciar o trial, ou alterar `trial_started_at`/`status` de forma alguma.

**Proposta técnica (resto, sem mudança de fundo):**

- **Não reaproveitar `configuracoes.assinatura_status` para a Rede** — misturar dois planos numa coluna só cria ambiguidade ("vencida" de qual dos dois produtos?). Propor tabela própria `rede_assinaturas`: `user_id` (PK/FK), `status` (enum: `trial`, `ativa`, `vencida`, `cancelada`), `trial_started_at`, `criado_em`, com a RLS corrigida acima.
- `lib/assinatura.ts` (`computeAssinatura`) já é uma função pura que recebe `trialStartedAt` + `status` + `ref` e devolve o estado efetivo — o mesmo cálculo serve para a Rede sem duplicar lógica, bastando chamá-la com os dados de `rede_assinaturas` em vez de `configuracoes`. Reaproveitamento de código existente, não muda a análise de RLS acima (o cálculo é leitura/derivação, não escrita).
- **Dois portões, não um:** (1) acesso à Rede = ter convite resgatado (seção 8, dentro do MVP); (2) uso pleno/pago = `rede_assinaturas.status = 'ativa'` (fora do MVP, proposta). O que acontece com quem tem acesso mas está com assinatura vencida é **decisão de produto em aberto** — não precisa ser resolvida para o beta, já que o MVP pode rodar sem gate de billing algum.
- **Permissão de moderação (denúncias, seção 7, dentro do MVP):** não existe conceito de role hoje em lugar nenhum do projeto. Proposta mínima para não superengenhar: tabela `rede_admins` (`user_id` PK, `criado_em`) como allowlist simples — sem sistema de roles genérico, só uma lista de quem pode revisar `rede_denuncias` e alterar seu `status`. Expandir para roles granulares só se/quando o produto pedir mais de um nível de moderação.

---

## Resumo de entidades novas propostas

| Tabela | Escopo | Depende de | Contém dado de outro usuário além do dono? |
|---|---|---|---|
| `rede_perfis` | MVP | `auth.users` | Não (1:1 dono) |
| `rede_livelinks` | MVP | `rede_perfis` | Não (1:1 dono), mas é lido por terceiros |
| `rede_posts` | MVP (texto/categoria); anônimo/imagem fora do MVP | `rede_perfis` | Não (autor é dono), lido por terceiros |
| `rede_comentarios` | MVP (não-anônimo); anônimo fora do MVP | `rede_posts` | Sim (comenta em post de outra pessoa) |
| `rede_curtidas` | MVP | `rede_posts` | Sim |
| `rede_amizades` | MVP | `auth.users` (2x) | Sim, por natureza |
| `rede_conversas` + `rede_conversas_participantes` + `rede_mensagens` | MVP (texto) | `auth.users` | Sim, por natureza |
| `rede_bloqueios` | MVP | `auth.users` (2x) | Sim, por natureza |
| `rede_denuncias` | MVP (fila mínima) | polimórfico | Sim, por natureza |
| `rede_solicitacoes_beta` | MVP | `auth.users` | Não |
| `rede_convites` | MVP | `rede_solicitacoes_beta` (opcional) | Não |
| `rede_assinaturas` | Fora do MVP — proposta | `auth.users` | Não |
| `rede_admins` | MVP (allowlist mínima) | `auth.users` | Não (allowlist) |

A mudança de modelo de ameaça relevante para quem for revisar isto: **todas as tabelas atuais do JobApp são dado 100% privado por dono** (RLS = `auth.uid() = user_id`, sem exceção). A Rede introduz, pela primeira vez no projeto, dados que **precisam ser lidos por outros usuários por design** — a RLS deixa de ser um `CHECK` simples e passa a expressar regra de negócio real (bloqueio, amizade, anonimato). Isso é o maior salto de complexidade desta iniciativa, mais do que a quantidade de tabelas em si.
