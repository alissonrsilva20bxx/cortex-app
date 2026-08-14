# T12 — Relatório de prontidão para lançamento (Beta fechado, 15 testadoras)

**Ticket:** [#39](https://github.com/alissonrsilva20bxx/cortex-app/issues/39) · **Branch:** `agent/claude-revisao-final-t12` · **Baseline:** `mockuptesterede @ 38c8716` (merge de T11/#62)
**Escopo:** consolidação de evidências T1–T11, checagem cruzada dos 56 P0 + 33 P1 do checklist funcional, auditoria adicional de segurança/acessibilidade/estados/temas, classificação de pendências #48–#61, e recomendação objetiva de GO/NO-GO para o beta fechado.
**Este ticket não executa merge, deploy, migration nem acessa Supabase remoto.** Seu estado terminal correto é "Aguardando aprovação humana" — nunca "Concluído".

> Nota de processo: nenhum arquivo de produção foi alterado para produzir este relatório (conforme whitelist da issue #39 — "nenhum arquivo de produção"). Toda falha encontrada durante a auditoria foi registrada como constatação neste documento, não corrigida diretamente.

> **Nota de atualização (rodada corretiva, mesmo PR #63):** após `VEREDITO: APROVADO` de Claude 2 (revisão técnica, GO condicional), o humano responsável autorizou explicitamente uma rodada corretiva pontual, ainda nesta mesma branch/PR, limitada aos itens locais e verificáveis abaixo — item 0 (verificação de schema remoto) permanece intocado, fora de alcance de qualquer agente deste pacote:
>
> - Citação incorreta corrigida: a afirmação sobre produção parada num deploy "sem Rede" está em `MASTER_PROMPT.md` (linha 5), não em `CONTEXT.md` (glossário de domínio, sem menção a deploy/produção) — apontado por Claude 2 na revisão.
> - **#53 corrigido**: segunda confirmação adicionada ao "Bloquear" do menu de Amigas (`AmigasScreen.tsx`), mesmo padrão de `PerfilPublicoScreen.tsx`/chat (T9). Teste em `tests/wiring/amigas-block-confirmation.test.ts`.
> - **Bug do `PinSetup` corrigido**: falha do `upsert` ao salvar o PIN agora exibe erro claro e preserva o estado (sheet permanece aberto), em vez de fechar silenciosamente como sucesso. Teste em `tests/wiring/pinsetup-save-error.test.ts`.
> - **Wishlist/Clientes rotuladas como demonstração**: `WishlistScreen.tsx`, `ClientesScreen.tsx` e a prévia de Desejos em `MeuEspacoScreen.tsx` agora exibem o mesmo aviso "Demonstração" já usado para Clientes. Nenhum backend/dado inventado — decisão de persistir de verdade ou remover do beta registrada separadamente na issue [#64](https://github.com/alissonrsilva20bxx/cortex-app/issues/64). Teste em `tests/wiring/wishlist-clientes-demo-label.test.ts`.
> - **Rotas `/dev-preview/` gateadas por ambiente**: `middleware.ts` agora bloqueia (404) essas rotas em produção, reaproveitando o mesmo sinal `isDevPreviewEnvironment()` já usado pelo endpoint de bootstrap — inalterado fora de produção (dev local, previews). Teste em `tests/wiring/dev-preview-route-production-gate.test.ts`.
> - **Blocos demonstrativos do Feed revisados**: confirmado que os blocos alimentados por `lib/mockRede.ts` continuam marcados `demo: true` e só por isso renderizam o aviso "Demonstração"; nenhum código alterado. Teste novo (cobertura que não existia) em `tests/wiring/feed-demo-blocks-labeled.test.ts`.
>
> As seções abaixo foram atualizadas para refletir esses fechamentos; o corpo original da auditoria (o que foi encontrado e por quê) foi preservado como está. **Item 0 (confirmar no painel do Supabase que as migrations `0005`–`0018` estão aplicadas em produção) permanece o único bloqueio real, e continua sendo uma ação humana externa — nenhum agente deste pacote tentou resolvê-lo, inferi-lo ou acessá-lo.**

---

## 1. Resumo executivo

|                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **56/56 P0 do checklist funcional**            | Verificados (T11): 53 automatizados + 2 manuais documentados + 1 superado por decisão humana (issue #30). Zero falhas. Reconfirmado na auditoria: suíte 505/506 passando; reconfirmado de novo após a rodada corretiva: **523/525 passando** (+19 testes novos), mesmas 2 falhas pré-existentes de sempre (#58, #60 — ver seção 2.3).                                                                                                                                                                |
| **33/33 P1 do checklist funcional**            | Verificados (T11): 26 automatizados + 6 manuais documentados + 1 N/A confirmado. Zero falhas.                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Novos P0 encontrados nesta auditoria (T12)** | 0 de código; **1 gate de processo** — status de aplicação do schema de Rede (migrations 0005–0018) no Supabase de produção não está confirmado, e a documentação interna do próprio projeto já registra essa incerteza há semanas sem resolução visível (ver seção 3.3 e 5.2).                                                                                                                                                                                                                       |
| **Novos P1 encontrados nesta auditoria (T12)** | Múltiplos (ver seção 3) — nenhum é regressão funcional que quebre o app; a maioria é ausência de estado de erro/offline dedicado (cai silenciosamente em "vazio") e lacunas de acessibilidade (alvo de toque, cobertura de tema).                                                                                                                                                                                                                                                                    |
| **Pendências #48–#61 bloqueantes**             | 0 — **#53 corrigido na rodada corretiva** (confirmação antes de bloquear no menu de Amigas, ver nota de atualização acima)                                                                                                                                                                                                                                                                                                                                                                           |
| **typecheck / lint / build / testes**          | typecheck limpo · lint limpo (2 warnings não-bloqueantes) · build de produção OK · **523/525 testes passando** após a rodada corretiva (2 falhas pré-existentes, #58 e o flake #60 — nenhuma nova)                                                                                                                                                                                                                                                                                                   |
| **RLS / isolamento de contas**                 | Nenhuma tabela sensível sem RLS, nenhuma policy permissiva demais, nenhum vazamento de isolamento confirmado (Cofre auditado linha a linha). Ressalva P1 de processo: confirmar que a migration `0018` está de fato aplicada no Supabase remoto (fora do escopo desta auditoria local).                                                                                                                                                                                                              |
| **Dados demonstrativos em produção**           | Nenhum dado fake inserido via `seed.sql`/migrations. Blocos "Pessoas que talvez você conheça"/"Desejo próximo da meta" no Feed continuam rotulados "Demonstração" (reconfirmado na rodada corretiva). Telas **Wishlist/Clientes** — achado sem rótulo desta auditoria — **agora rotuladas "Demonstração" também** (rodada corretiva); persistência real ou remoção do beta ficam para decisão em issue separada ([#64](https://github.com/alissonrsilva20bxx/cortex-app/issues/64)) — ver seção 3.3. |

---

## 2. Verificações mecânicas

### 2.1 Setup e integridade de branch/worktree

- Worktree isolado `C:\Users\miguel\JobApp-Claude-RevisaoFinal`, branch `agent/claude-revisao-final-t12`, criado a partir de `origin/mockuptesterede @ 38c8716348ff7b30fdba5fb2d8e63ed69eca075b` (merge do T11/#62).
- `master` verificada intocada antes e depois: `5fa3b4d17ec136844bcc89268b1959f42e3ecc91`.
- T1–T11 confirmados "Done" no GitHub Project antes de iniciar (`gh project item-list`).

### 2.2 typecheck / lint / build

- `npm run typecheck` (`tsc --noEmit`): **limpo**, sem erros.
- `npm run lint` (`next lint`): **limpo**, 2 warnings não-bloqueantes:
  - `components/cofre/CofreTab.tsx:90` — `<Image>` sem `alt` (jsx-a11y/alt-text).
  - `components/rede/FeedScreen.tsx:89` — `useMemo` com dependência `usuario.id` ausente (react-hooks/exhaustive-deps).
- `npm run build` (produção): **sucesso**, 14 páginas geradas, sem erros de prerender (após configurar `.env.local`/`.env.test.local` apontando exclusivamente para o Supabase local `127.0.0.1:54321` — nenhuma variável de produção foi usada ou acessada).

> **Reexecução após a rodada corretiva** (mesmo PR #63): typecheck, lint e build reconfirmados limpos/OK nos exatos mesmos termos acima, contra o HEAD atualizado.

### 2.3 Suíte de testes (contra Supabase local descartável)

- `SUPABASE_TEST_URL=http://127.0.0.1:54321` (confirmado local antes de qualquer teste rodar).
- `npm test` (`vitest run`), auditoria original: **505/506 passando**.
- `npm test` (`vitest run`), **reexecução após a rodada corretiva**: **523/525 passando** (+19 testes novos desta rodada — 4 em `amigas-block-confirmation.test.ts`, 4 em `pinsetup-save-error.test.ts`, 3 em `wishlist-clientes-demo-label.test.ts`, 3 em `dev-preview-route-production-gate.test.ts`, 5 em `feed-demo-blocks-labeled.test.ts` —, todos vermelho→verde confirmados contra o código pré-correção antes de cada commit).
  - Mesmas 2 falhas de antes, nenhuma nova:
    - `tests/wiring/cofre-visual.test.ts` — issue [#58](https://github.com/alissonrsilva20bxx/cortex-app/issues/58), pré-existente, assert desatualizado sobre `PostComposer.tsx`/`FilterChips` (que já tinha `minTouchTarget` antes desta rodada), não relacionada a regressão de produto. Confirmado que nem `ClientesScreen.tsx` nem `WishlistScreen.tsx` — os dois arquivos tocados nesta rodada que esse teste também cobre — introduziram `minTouchTarget`.
    - `tests/rede/concurrency/curtidas.concurrency.test.ts` — issue [#60](https://github.com/alissonrsilva20bxx/cortex-app/issues/60), flake conhecido; reproduzido falhando 1x e passando 1x em execuções isoladas consecutivas nesta sessão, confirmando o comportamento intermitente já documentado (test-infra, não regressão).
- Cobertura de RLS: suítes dedicadas em `tests/rede/rls/**` (`jobs`, `beta-gating`, `rede_perfis`, `social-graph`, `rede_conteudo`, `rede_denuncias`, `messaging`, `bloqueios-perfis-amizades`, `bloqueios-gerenciamento`) — todas executadas como parte da suíte completa, todas passando, sem alteração nesta rodada.

---

## 3. Achados da auditoria T12 (além do que T1–T11 já cobriram)

Seis frentes de auditoria somente-leitura foram conduzidas nesta rodada sobre o estado atual do código (não apenas revalidando o checklist de 07/08, mas lendo o código linha a linha). Nenhuma alteração de código foi feita — cada achado abaixo é uma constatação para decisão humana ou para virar issue separada.

### 3.1 Login, cadastro, recuperação, onboarding

**Decisão de produto de base:** o app usa **exclusivamente Google OAuth** (`docs/adr/0001-google-oauth-exclusivo.md`) — não há cadastro por e-mail/senha nem recuperação de senha por decisão deliberada e documentada. Isso não é uma lacuna, é escopo.

| Fluxo                | P0                         | P1  | P2  |
| -------------------- | -------------------------- | --- | --- |
| Login (Google OAuth) | 0                          | 3   | 1   |
| Cadastro             | — (não existe por decisão) | 0   | 1   |
| Recuperação de senha | — (não existe por decisão) | 1   | 0   |
| Onboarding           | 0                          | 2   | 4   |

Achados P1 mais relevantes:

- **Login não exibe erro de callback OAuth** — `app/login/page.tsx` nunca lê o parâmetro `?error=...` que `app/auth/callback/route.ts` já produz em caso de falha. Usuária com login recusado/falho só vê a tela normal, sem explicação.
- **`handleGoogleLogin` sem try/catch** — se `signInWithOAuth` rejeitar (ex. offline), o botão trava em "Redirecionando…" indefinidamente, sem retry nem mensagem.
- **Bootstrap pós-login sem `.catch`** (`app/page.tsx:106-133`) — falha de rede na sessão/config trava a usuária no `LoadingScreen` (só spinner, sem timeout/erro) indefinidamente.
- **Nota de consequência da própria ADR não implementada**: a ADR exige documentar na tela de login que revogar acesso ao Google desconecta a usuária do app — isso não está na UI hoje.
- **Bug real no onboarding**: `PinSetup.tsx:66-75` (`savePin`) nunca verifica o `{error}` do `upsert` — se a gravação do PIN falhar, o fluxo segue como sucesso e a usuária acredita ter uma proteção ativa que não existe.
- **Nenhum teste cobre `app/login/page.tsx`, `app/auth/callback/route.ts`, `PinSetup.tsx` ou `OnboardingFlow.tsx`** diretamente — é a lacuna de teste que permitiu o bug do PIN passar despercebido em T1–T11.

### 3.2 Início, Agenda, Financeiro, Cofre

Nenhum achado P0 novo — os P0 do checklist original já foram resolvidos e revalidados pelo T11.

- **Cofre — isolamento entre contas: auditado linha a linha, nenhum vazamento encontrado.** Toda leitura/escrita de Storage é escopada por `${userId}/...` no client **e** reforçada por RLS real no bucket (`storage.objects`, policy que compara `auth.uid()` com o primeiro segmento do path) — dupla camada, não depende só do client.
- **Padrão recorrente (P1) em Início/Agenda/Financeiro/Cofre**: nenhuma das 4 abas distingue erro de rede de "vazio" — falha silenciosa cai em estado vazio, sem toast/mensagem. Nenhuma checagem de offline dedicada.
- **P1**: persistência real de `JobForm`/`DespesaForm`/`ReceitaForm`/`MetaForm` (criar/editar) não tem teste automatizado — só roteiro manual documentado no T11 (lacuna de infraestrutura de teste, não de implementação).
- P2 menores (código morto `homeCards.financeSummary`/`cardStyles`; FAB do Financeiro sempre rotulado "Editar Meta" mesmo em Entradas/Saídas; queries de `jobs` sem `.eq("user_id")` explícito, coberto por RLS mas inconsistente com o resto do código; `openFile` do Cofre sem tratamento de erro do `createSignedUrl`).

### 3.3 Rede (gate, feed, perfis, amizades, bloqueios, conversas, notificações)

**Achado mais importante desta auditoria (gate de processo, não defeito de código):** a documentação interna do próprio projeto (`docs/rede/CURRENT_BACKEND_AUDIT.md`, `docs/rede/REMOTE_SCHEMA_DIFF.md`, `MASTER_PROMPT.md`) registra, de forma explícita e ainda não revertida por nenhum documento posterior encontrado, que **o schema remoto de produção pode não refletir as migrations versionadas no repositório**. A captura mais recente encontrada (`REMOTE_SCHEMA_DIFF.md`, 2026-07-25) mostra o remoto com **apenas 4 tabelas base** (`configuracoes`, `jobs`, `metas`, `notas`) — nenhuma tabela de Rede (`rede_*`) presente. `MASTER_PROMPT.md` (linha 5) também registra que a produção pode estar parada num deploy "sem Rede". A própria migration `0018_rede_bloqueios_gerenciamento.sql` (linhas 23-25) se autodeclara "pendente de aplicação remota e de nova autorização humana antes do lançamento". **Esta auditoria não pode confirmar nem refutar isso** — é proibido acessar Supabase remoto a partir deste ticket. Recomendo tratar como bloqueante de verificação (não de correção): antes de convidar as 15 testadoras, alguém com acesso ao painel Supabase de produção precisa confirmar que as migrations `0005`–`0018` (toda a Rede, incluindo RLS de bloqueio) estão de fato aplicadas — sem isso, nenhuma das garantias de segurança abaixo (bloqueio, isolamento, RLS) tem qualquer efeito real em produção, por mais corretas que estejam no código.

Com essa ressalva registrada, a auditoria do **código e da lógica** (validada contra Supabase local, idêntico ao que seria aplicado em produção) encontrou o seguinte:

**Gate / Acesso à beta — sólido, sem lógica fake sobrevivendo.**

- Convites: hash SHA-256, resgate atômico (`UPDATE ... WHERE usado_por IS NULL AND expira_em > now()`), rate limit persistido no banco (5 tentativas/15min, por usuário e IP) — `supabase/migrations/0015_rede_convites_rpc.sql`.
- `verificarAcessoConvite` é **fail-closed** comprovado: qualquer erro de rede retorna `{unlocked:false}`, nunca destrava por engano (`lib/rede/acesso.ts`, testado em `tests/rede/services/acesso.test.ts`).
- `?vitrine=1` só força exibir a vitrine, nunca desbloqueia sozinho — não é backdoor.
- **[P1]** `/dev-preview/rede` e `/dev-preview/app` ficam **publicamente acessíveis sem login também em produção** — `middleware.ts` marca essas rotas como públicas incondicionalmente, sem checar `NODE_ENV` (só o endpoint de bootstrap de sessão é bloqueado em produção, não a página em si). Elas servem uma versão inteira do app — incluindo a Rede — com Supabase inteiramente mockado e perfis fictícios hardcoded (ex. "Camila Duarte"). Não é vazamento de dado real (é tudo mock), mas é uma superfície pública não intencional mostrando um produto "fake" sem exigir login. Decisão necessária: gatear por `NODE_ENV` (mesmo padrão já usado no endpoint de bootstrap) ou confirmar que é intencional e documentar.

**Feed e publicações — dados reais, com uma área de mock parcialmente rotulada.**

- `listarFeed`/`criarPost`/`criarComentario`/`alternarCurtida` 100% reais, com RLS de conteúdo respeitando bloqueio.
- Estados loading/vazio/erro cobertos (skeleton real, erro persistente distinto de vazio). Offline não tem tratamento dedicado no Feed especificamente (diferente do chat) — **P2**.
- **[P1]** Blocos "Pessoas que talvez você conheça" e "Desejo próximo da meta" usam `lib/mockRede.ts` (nomes fictícios fixos) dentro do feed real de produção. Já rotulados como "Demonstração — sugestão de exemplo, ainda sem dado real por trás" no código atual, o que mitiga bastante o risco original identificado no plano de 11/08 — mas ainda mistura conteúdo fabricado com o feed real. Recomendo decisão de produto final: manter rotulado, ou remover antes do beta.

**Perfis / Amizades — sólido, nenhum P0/P1 na lógica em si.** Bloqueio filtrado nos dois sentidos em sugestões/busca/solicitações; LiveLinks e wishlist de terceiros sempre vazios para quem não é o dono (`isMe` checado consistentemente).

**Bloqueios — área mais crítica, revisão rigorosa, comportamento correto e testado contra Postgres real (não só mocks) em todas as superfícies**: feed/posts/comentários/curtidas, perfis/LiveLinks, pedido de amizade, amigas/sugestões, notificações, criação de conversa, leitura/envio de mensagens — todas com RLS bidirecional e/ou filtro aplicativo, com testes de RLS reais (`tests/rede/rls/bloqueios-perfis-amizades.rls.test.ts`, `messaging.rls.test.ts` etc.) provando os dois sentidos e confirmando que terceiros não são superrestringidos.

- **[P1]** A RPC `rede_listar_bloqueados` (migration 0018, tela "Pessoas bloqueadas"/desbloquear) está marcada como não aplicada remotamente. Sem ela em produção, bloquear continua funcionando mas **desbloquear pela UI fica impossível** — regressão funcional, não de privacidade.

**Conversas / Mensagens — sólido.** Keyboard-avoidance real via `visualViewport`, loading/erro/vazio/offline cobertos com banner e retry, 3 estados de mensagem (enviando/erro-com-retry/normal), confirmação de bloqueio dedicada no menu do chat, denúncia de usuário a partir do chat. Nenhum achado P0/P1 novo aqui. Gap pré-existente já documentado no glossário do domínio: revalidação de PIN por rota sensível no chat da Rede ainda não implementada (**P2**, fora do escopo original de T12).

**Notificações — sólido.** Cursor real, filtro bidirecional de bloqueio testado explicitamente nos dois sentidos, estados loading/erro/vazio/offline cobertos, "marcar todas como lidas" desabilitado offline. Achado **P2** só de documentação de teste (um arquivo alega cobrir notificações mas a cobertura real está em outro).

**Dados demonstrativos — achado adicional relevante fora do escopo original de 7 áreas, mas direto ao item "riscos de dados demonstrativos chegando à produção" do pedido:**

- **[P1]** As telas **Wishlist** e **Clientes** (alcançáveis por navegação normal a partir de "Meu Espaço") são **100% baseadas em `useState` local sem nenhuma tabela Supabase por trás** — qualquer edição feita pela usuária (`WishlistForm`, `ClienteForm`) some no próximo reload, e **diferente dos blocos do Feed, essas telas não têm nenhum rótulo de "demonstração"**. Uma testadora real pode achar que está cadastrando clientes/desejos de verdade e perder o trabalho sem aviso. Recomendo decisão de produto: persistir de verdade, remover as telas do beta, ou rotular claramente como protótipo — mesmo padrão já usado no Feed.
- `supabase/seed.sql` confirmado sem nenhum dado fake (só um `GRANT` de compatibilidade local).

Cruzamento com o checklist funcional de Rede (§6.1–§6.11): nenhum item P0 permanece aberto no código deste repositório — os P0 originais do checklist (gate 100% fake, filtro de amizade ausente no feed, bloqueio ausente, etc.) foram todos resolvidos e têm cobertura de teste real, incluindo testes de RLS contra Postgres local. Os achados residuais listados acima (dev-preview público, migration 0018 pendente, Wishlist/Clientes sem rótulo) pertencem à superfície de implantação/produção, não à paridade funcional entre mock visual e app real — por isso não apareciam no checklist original de 07/08.

### 3.4 Temas, acessibilidade, responsividade

- **Temas: 8 confirmados no código** (`grafite`, `pink-neon`, `purple`, `crimson`, `ocean`, `gold`, `emerald`, `midnight`) × 2 modos (claro/escuro via `data-mode`) = 16 combinações possíveis. Os "3 temas de baseline" citados na issue #39 são `pink-neon`/`purple`/`crimson` — os únicos que existiam no enum remoto original do banco antes de 07/2026 (os outros 5 foram adicionados depois só no client).
  - **Nenhuma das 16 combinações tem teste automatizado real** (o projeto não tem Playwright/Storybook/Chromatic; os testes "-visual" são checagem de string em código-fonte, não renderização). Não há documentação de QA manual cobrindo as 16 combinações. **P1.**
- **Contraste WCAG: nenhuma verificação existe** (sem `eslint-plugin-jsx-a11y` de contraste, sem lib de contraste, sem teste). Vários temas usam texto translúcido sobre fundo escuro/glow — risco real e não verificado, principalmente em modo claro. **P1.**
- **Alvos de toque 44px: bom em BottomNav e gates da Rede (testados); gap real em 8 dos 17 consumidores de `BottomSheet`** que não passam `largeCloseTarget` — inclui **Notificações**, `PinSetup`, "Instalar app" — botão fechar fica em ~28×28px. Não rastreado no checklist original. **P1.**
- **Foco/teclado**: bom (`:focus-visible`, focus trap completo nos sheets). Gaps menores: sem skip-link; `<select>` perde indicador de foco (outline removido globalmente, não recoberto). **P2.**
- **Safe area**: implementado e testado consistentemente (`viewport-fit=cover`, `env(safe-area-inset-*)` em todos os componentes relevantes). Sem achados.
- **`prefers-reduced-motion`**: implementado globalmente via media query, testado contra regressão. Sem achados.
- **Responsividade**: app é mobile-first fixo (390×844); **nenhum breakpoint Tailwind é usado em nenhum componente**, nenhum teste de layout em resoluções desktop. Se o beta incluir acesso via desktop/tablet oficialmente, isso deveria estar documentado como decisão de produto — não encontrei esse registro. **P2 (P1 se desktop for escopo oficial do lançamento).**

### 3.5 RLS, isolamento, dados demonstrativos

- **Nenhuma tabela sensível sem RLS habilitado; nenhuma policy `USING (true)` encontrada** em nenhuma das 18 migrations. Todas as tabelas de dados financeiros, Cofre, mensagens, perfis e bloqueios têm policy restrita por `auth.uid()` (direto ou via função `security definer`).
- **`seed.sql` não insere nenhum dado fake/demo** — só um `GRANT` de compatibilidade. Execução é sempre manual via CLI local (`supabase db reset`), nunca automatizada contra remoto.
- **Testes de RLS cobrem praticamente toda tabela sensível**, com guardrail centralizado (`tests/rede/support/env.ts`) que lança exceção se a URL de teste não for `127.0.0.1`/`localhost` — nenhum teste consegue acidentalmente rodar contra produção.
- **P1 de processo (não de código)**: a migration `0018_rede_bloqueios_gerenciamento.sql` traz nota própria no cabeçalho informando que está **pendente de aplicação no Supabase remoto** e de nova autorização humana. Isso — junto com a observação já registrada em `docs/rede/CURRENT_BACKEND_AUDIT.md` de que o histórico de migrations do repositório pode não refletir exatamente o schema remoto — significa que **uma auditoria de código correta não garante nada se a migration correspondente nunca rodou em produção**. Recomendação: confirmar contra o Supabase remoto (fora do escopo desta auditoria local) que todas as 18 migrations, especialmente 0017/0018 (RLS de bloqueio), estão de fato aplicadas antes do beta.
- **P2 de higiene**: `supabase/criar_despesas.sql` e `supabase/criar_objetivos.sql` são scripts soltos legados, redundantes com a migration `0004`, com URL do projeto de produção real em comentário — recomendo remover antes do lançamento para reduzir ambiguidade de "fonte da verdade".
- **Risco de dado demonstrativo em produção, herdado de T7, parcialmente mitigado**: blocos "Pessoas que talvez você conheça" e "Desejo próximo da meta" no Feed mostram conteúdo fabricado (`DISCOVER_PEOPLE`/`WISHLIST_ITEMS` de `lib/mockRede.ts`), mas **já estão rotulados como "Demonstração"** no código atual — risco reduzido em relação ao originalmente identificado em 11/08, ainda assim vale confirmação final de produto. **Achado novo e sem rótulo (ver seção 3.3)**: telas Wishlist/Clientes inteiras, sem persistência real, sem nenhum aviso de protótipo.

---

## 4. Pendências #48–#61

| #      | Título                                                                        | Estado                         | Classificação                                                                                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 48     | Teste de integração: acesso restaurado após desbloquear                       | OPEN                           | Não-bloqueante (cobertura de teste, comportamento já garantido por RLS)                                                                                                                                                                                                                   |
| 49     | Rodar suíte completa como parte da aprovação humana de correções de segurança | OPEN                           | Não-bloqueante (processo)                                                                                                                                                                                                                                                                 |
| 50     | Coordenar numeração de migrations entre branches                              | OPEN                           | Não-bloqueante (housekeeping)                                                                                                                                                                                                                                                             |
| 51     | PR T7 — Feed                                                                  | MERGED                         | Não-bloqueante (concluído)                                                                                                                                                                                                                                                                |
| 52     | PR T8 — Perfis/Amizades/Bloqueios                                             | MERGED                         | Não-bloqueante (concluído)                                                                                                                                                                                                                                                                |
| **53** | **Confirmação antes de bloquear no menu de Amigas**                           | **FECHADO (rodada corretiva)** | Corrigido nesta mesma branch/PR: segunda confirmação adicionada a `AmigasScreen.tsx`, mesmo padrão de `PerfilPublicoScreen.tsx`/chat. Teste vermelho→verde em `tests/wiring/amigas-block-confirmation.test.ts`. Fechamento formal da issue fica a critério do humano após a nova revisão. |
| 54     | Paginação em listarMensagens/listarConversas                                  | OPEN                           | Não-bloqueante (risco cresce com o tempo, não com volume atual do beta)                                                                                                                                                                                                                   |
| 55     | Decisão de produto: excluir conversa                                          | OPEN                           | Não-bloqueante (feature ausente, não bug)                                                                                                                                                                                                                                                 |
| 56     | Causa-raiz 44px em componentes compartilhados                                 | OPEN                           | Não-bloqueante (P2, mas ver achado 3.4 — parcialmente sobreposto)                                                                                                                                                                                                                         |
| 57     | PR T9 — Conversas e notificações                                              | MERGED                         | Não-bloqueante (concluído)                                                                                                                                                                                                                                                                |
| 58     | Teste `cofre-visual.test.ts` quebrado                                         | OPEN                           | Não-bloqueante (test-infra, pré-existente)                                                                                                                                                                                                                                                |
| 59     | PR T10 — Ajustes                                                              | MERGED                         | Não-bloqueante (concluído)                                                                                                                                                                                                                                                                |
| 60     | Teste `curtidas.concurrency.test.ts` flaky                                    | OPEN                           | Não-bloqueante (test-infra)                                                                                                                                                                                                                                                               |
| 61     | LiveLinks cap 5 só client-side                                                | OPEN                           | Não-bloqueante (risco baixo, avaliado pela própria issue)                                                                                                                                                                                                                                 |

**Nenhum item bloqueante restante em #48–#61** — #53 corrigido na rodada corretiva (ver nota de atualização no topo do documento). O único bloqueio que permanece é o item 0 da seção 5.2 (verificação humana do schema remoto), que nunca esteve nesta tabela — é um gate de processo, não uma issue numerada.

---

## 5. Matriz GO/NO-GO

### 5.1 P0/P1/P2 — visão consolidada

| Severidade | Novos nesta auditoria (T12)                                                                                                                                                                              | Já conhecidos/pendentes                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**     | 0                                                                                                                                                                                                        | 0 (todos os P0 do checklist original resolvidos e verificados pelo T11)                                                                                                                       |
| **P1**     | ~13 (erro/offline não distinguido em Login/Início/Agenda/Financeiro/Cofre; ~~bug de `PinSetup`~~ **corrigido na rodada corretiva**; nota da ADR ausente; cobertura de tema; contraste; 44px em 8 sheets) | 0 bloqueante (#53 corrigido) + 1 de processo (confirmar migration 0018 aplicada em produção — parte do item 0) + risco de dado fabricado no Feed (herdado de T7, reconfirmado ainda rotulado) |
| **P2**     | ~10 (código morto, labels inconsistentes, `<select>` sem foco, responsividade desktop, higiene de scripts SQL)                                                                                           | Diversos já rastreados em #48-#61                                                                                                                                                             |

### 5.2 Pendências bloqueantes para o beta fechado

**0 (mais crítico — verificação, não correção de código, ainda em aberto). Confirmar que o schema completo da Rede (migrations `0005`–`0018`) está de fato aplicado no Supabase de produção.** A documentação interna do próprio projeto (`docs/rede/CURRENT_BACKEND_AUDIT.md`, `docs/rede/REMOTE_SCHEMA_DIFF.md`, `MASTER_PROMPT.md`) registra, sem revogação posterior encontrada, que a captura mais recente do schema remoto (2026-07-25) tinha só 4 tabelas base e nenhuma tabela de Rede, e que a produção pode estar parada num deploy "sem Rede". Todo o código, RLS e testes auditados neste relatório estão corretos **no repositório e no Supabase local** — mas isso só protege usuárias reais se o mesmo schema estiver de fato rodando em produção. **Esta auditoria, e a rodada corretiva que a seguiu, não podem confirmar isso — é proibido acessar Supabase remoto a partir de qualquer ticket deste pacote, e nenhuma tentativa de resolver, inferir ou contornar essa verificação foi feita.** Continua sendo uma ação humana externa, e continua precedendo tudo abaixo.

Os 5 itens pontuais abaixo — todos dentro do item 0, sem depender dele para serem corrigidos no código — foram tratados na rodada corretiva (mesmo PR #63, commits após o `VEREDITO: APROVADO` de Claude 2):

1. ~~**#53 — Confirmação antes de bloquear no menu de Amigas.**~~ **Corrigido.** `AmigasScreen.tsx` agora exige "Sim, bloquear"/"Cancelar" antes de chamar `onBlock`, mesmo padrão já usado em `PerfilPublicoScreen.tsx` e no chat. Teste vermelho→verde em `tests/wiring/amigas-block-confirmation.test.ts`.
2. **Decisão de produto sobre conteúdo fabricado do Feed** ("Pessoas que talvez você conheça", "Desejo próximo da meta") — reconfirmado na rodada corretiva que continua rotulado "Demonstração" e que só os blocos alimentados por `lib/mockRede.ts` recebem esse rótulo (`tests/wiring/feed-demo-blocks-labeled.test.ts`, cobertura nova). **Ainda pendente**: confirmação humana final de que a rotulagem é aceitável para o beta (ou remoção dos blocos) — não é uma correção de código.
3. **Migration `0018` (RLS de gerenciamento de bloqueios/tela de desbloqueio) especificamente marcada como não aplicada** — subconjunto do item 0 acima, **continua em aberto**: depende da mesma verificação humana no Supabase remoto, não de código.
4. ~~**Bug de `PinSetup` (falha silenciosa ao salvar PIN).**~~ **Corrigido.** `savePin` agora verifica o `{error}` do `upsert`, exibe mensagem clara e preserva o estado (sheet permanece aberto, PIN não é dado como ativo) em vez de fechar silenciosamente. Teste em `tests/wiring/pinsetup-save-error.test.ts`.
5. ~~**Telas Wishlist/Clientes sem persistência real e sem rótulo de demonstração.**~~ **Rótulo corrigido.** Ambas as telas e a prévia de Desejos agora exibem "Demonstração — sem tabela real ainda, não persiste entre sessões". Persistência real continua **não implementada** — decisão de produto (persistir, remover do beta, ou manter como demo) registrada separadamente em [#64](https://github.com/alissonrsilva20bxx/cortex-app/issues/64), fora do escopo pontual desta rodada.
6. ~~**`/dev-preview/rede` e `/dev-preview/app` publicamente acessíveis em produção.**~~ **Corrigido.** `middleware.ts` agora retorna 404 para `/dev-preview/**` sempre que `NODE_ENV === "production"`, reaproveitando o mesmo sinal já usado pelo endpoint de bootstrap de sessão; inalterado fora de produção. Teste em `tests/wiring/dev-preview-route-production-gate.test.ts`, suíte existente de middleware sem regressão.

**Após a rodada corretiva, o único bloqueio real que resta é o item 0** (mais o item 3, que é o mesmo bloqueio sob outro nome) e a decisão de produto do item 2 (que nunca foi uma correção de código).

### 5.3 Pendências aceitas para pós-beta (não bloqueantes)

- Todas as 13 issues não-bloqueantes de #48–#61 (seção 4).
- Estados de erro/offline ausentes fora do módulo Rede (Login, Início, Agenda, Financeiro, Cofre) — real, mas não é regressão nova; recomendo registrar como débito técnico explícito, não silenciar.
- Cobertura de tema/contraste/44px fora da BottomNav (seção 3.4) — recomendo pelo menos uma passada manual nos 8 temas × 2 modos antes do beta (ver checklist manual, seção 7), mesmo sem automatizar agora.
- Responsividade desktop — aceitável se o beta for declarado mobile-only; recomendo registrar essa decisão explicitamente.
- Higiene de scripts SQL soltos (`criar_despesas.sql`/`criar_objetivos.sql`).

### 5.4 Riscos residuais

- **Sem observabilidade**: nenhuma ferramenta de captura de erro client-side (Sentry ou equivalente) — falhas silenciosas (erro indistinguível de vazio, tema quebrado, etc.) dependem 100% de reporte manual das 15 testadoras.
- **Sem feature flag para a Rede**: não há como desligar só a Rede isoladamente se um problema sistêmico aparecer durante o beta.
- **Confiança na aplicação remota das migrations**: esta auditoria não pode confirmar (por proibição de acesso remoto) que o schema de produção bate 100% com as 18 migrations do repositório — é uma verificação humana pendente antes do lançamento.
- **`lib/rede/denuncias.ts`**: fluxo de denúncia real e testado a nível de serviço/RLS (`tests/rede/services/denuncias-admin.test.ts`, `tests/rede/rls/rede_denuncias.rls.test.ts`), mas sem teste de wiring da UI (menu → sheet → envio) — risco residual baixo, não bloqueante.

---

## 6. Plano de rollback

Não existe hoje um feature flag dedicado para desligar a Rede isoladamente. Alavancas de reversão disponíveis sem trabalho novo de engenharia:

1. **Problema isolado a uma conta**: revogar o convite específico via a RPC admin já existente (`rede_gerar_convite`/gestão de convites).
2. **Problema sistêmico**: reverter o merge na branch `mockuptesterede` e promover o deployment anterior no Vercel (histórico de deployments já existe por padrão).
3. Recomendo documentar esse plano formalmente (quem executa, em qual condição, tempo esperado) antes de convidar as 15 testadoras — não descobrir a rota de reversão no meio de um incidente real.

---

## 7. Checklist manual para 15 testadores (beta fechado)

### Cobertura recomendada

| Eixo              | Cobertura                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sistema/navegador | iOS Safari (alvo primário, 390×844) + Android Chrome, mínimo 1 aparelho de cada                                                                                                         |
| Temas             | Padrão + pelo menos 2 das 8 variantes (recomendo incluir 1 das 5 não-baseline: ocean/gold/emerald/grafite/midnight, já que essas nunca foram validadas contra o schema remoto original) |
| Modo              | Claro e escuro, para cada tema testado                                                                                                                                                  |
| Acessibilidade    | `prefers-reduced-motion` ativado em pelo menos 1 rodada                                                                                                                                 |
| Contas            | Mínimo 2 contas reais interagindo entre si por rodada (amizade/bloqueio/chat/notificação não são testáveis sozinha)                                                                     |

### Roteiro objetivo (complementa o roteiro manual já detalhado em `docs/rede/T11_ROTEIRO_FIDELIDADE_FUNCIONAL.md`, seção "Roteiro manual")

1. Login com Google, incluindo o caminho de erro (negar permissão na tela do Google) — confirmar que alguma mensagem aparece (hoje não aparece — ver achado 3.1).
2. Onboarding completo: meta mensal + ativar PIN; sair do app, reabrir, confirmar que o PIN de fato bloqueia o Cofre (ver achado 3.1 — bug conhecido).
3. Criar atendimento completo (Agenda/Início), despesa, receita e meta financeira; confirmar persistência após reload.
4. Cofre: upload de arquivo, reabrir, confirmar isolamento (usar 2 contas, confirmar que uma não vê arquivos da outra).
5. Rede: resgatar convite, completar perfil, dar 1 LiveLink, curtir/comentar/publicar, enviar pedido de amizade e aceitar (conta B), bloquear e confirmar que desaparece dos dois lados, desbloquear.
6. **Bloquear pelo menu de Amigas** — confirmar comportamento atual (sem confirmação, achado bloqueante #53) e reportar se corrigido antes do beta.
7. Conversa: enviar mensagem, confirmar chegada em tempo real na outra conta, testar teclado sobre o composer em pelo menos 2 aparelhos diferentes (risco conhecido de offset fixo).
8. Notificações: gerar 1 de cada tipo (curtida/comentário/pedido de amizade/mensagem), confirmar que aparecem e que o botão fechar é fácil de tocar (achado P1 3.4 — abaixo de 44px hoje).
9. Trocar tema 2x (incluindo 1 não-baseline) e modo claro/escuro; confirmar legibilidade de texto em todas as telas visitadas, sem reload quebrado (FOUC).
10. Desligar a rede (modo avião) em pelo menos 1 tela de cada aba; confirmar que aparece algum feedback (hoje, na maioria das telas fora da Rede, não aparece — achado P1 recorrente 3.2).
11. Ativar "reduzir movimento" no sistema operacional e repetir a navegação básica; confirmar ausência de animações longas.
12. Registrar qualquer tela onde o botão "fechar" (X) pareça pequeno demais para o dedo.

---

## 8. Recomendação objetiva

**GO condicional — não é um NO-GO, mas também não é um GO incondicional.** Após a rodada corretiva registrada na nota de atualização (topo do documento), 4 dos 5 itens de correção pontual do parecer original já estão fechados no código; resta um único item de verificação que precede tudo, e uma decisão de produto que nunca foi uma correção de código:

**Item 0 (precede todos os outros, ainda em aberto — ação humana externa):** confirmar, contra o painel Supabase de produção (fora do alcance de qualquer ticket deste pacote, que é proibido de acessar remoto), que as migrations `0005`–`0018` — toda a Rede, incluindo a RLS de bloqueio — estão de fato aplicadas. A documentação interna do próprio projeto levanta essa dúvida há semanas sem registro de resolução; se o schema remoto ainda for só as 4 tabelas base do app original (cenário descrito em `REMOTE_SCHEMA_DIFF.md`), **a Rede inteira simplesmente não funciona em produção** e nenhum dos achados de código deste relatório é relevante ainda. Esta é uma checagem de poucos minutos para quem tem acesso ao painel — mas é estritamente pré-requisito, e nenhum agente deste pacote tentou resolvê-la, inferi-la ou acessá-la.

Dos 5 itens pontuais originalmente listados, o estado agora é:

1. ~~Corrigir #53 (confirmação de bloqueio no menu de Amigas).~~ **Feito.**
2. Confirmar que a rotulagem "Demonstração" já presente no Feed é aceitável para o beta (ou remover os blocos fabricados) — **ainda pendente, decisão humana de produto**, não uma correção de código; engenharia reconfirmou que o rótulo continua correto e coberto por teste.
3. ~~Corrigir o bug de `PinSetup` que pode dar falsa sensação de PIN ativo.~~ **Feito.**
4. ~~Decidir o destino das telas Wishlist/Clientes.~~ **Rotuladas como demonstração** nesta rodada; a decisão de persistir de verdade ou remover do beta fica registrada em [#64](https://github.com/alissonrsilva20bxx/cortex-app/issues/64), fora do escopo pontual autorizado.
5. ~~Decidir se `/dev-preview/rede`/`/dev-preview/app` devem ficar públicas em produção.~~ **Feito** — gateadas por `NODE_ENV`, bloqueadas (404) em produção.

Considerando que **0 P0 de código do checklist funcional de 105 itens está aberto**, que a suíte de testes está estável (mesmo patamar de antes da rodada corretiva, mais os testes novos — números atualizados na seção 2.3 após a nova execução), que o build de produção é limpo, que a auditoria de RLS/bloqueio não encontrou nenhuma tabela desprotegida nem vazamento de isolamento entre contas (Cofre incluído, auditado linha a linha), e que 4 dos 5 itens pontuais foram corrigidos nesta mesma branch — **o código está estruturalmente pronto para um beta fechado de 15 pessoas conhecidas**. A única incerteza que pode mudar essa leitura de forma material continua sendo o item 0 (estado real do banco de produção), que só uma pessoa com acesso ao painel Supabase pode resolver.

Esta recomendação é uma leitura técnica, não uma autorização de lançamento — a decisão final é humana, conforme o próprio ticket exige.

---

## 9. Metodologia desta auditoria

- 6 frentes de auditoria somente-leitura (login/onboarding; Início/Agenda/Financeiro/Cofre; Rede completa; temas/acessibilidade/responsividade; RLS/segurança/dados demo; classificação de #48-#61), cada uma lendo o código-fonte atual linha a linha, cruzando com `JOBAPP_FUNCTIONAL_PARITY_CHECKLIST_2026-08-07.md` e com `docs/rede/T11_ROTEIRO_FIDELIDADE_FUNCIONAL.md`.
- Testes executados (typecheck, lint, build, suíte completa) diretamente neste worktree, contra Supabase local descartável (`127.0.0.1:54321`), nunca remoto.
- Nenhum arquivo de produção foi editado. Nenhuma migration foi aplicada em lugar nenhum além do Supabase local efêmero deste ticket. Nenhum `.env*` foi lido ou exposto.
- Este relatório não reproduz detalhes explícitos de exploração de vulnerabilidades — achados de segurança são descritos como risco + localização, para correção por um revisor humano.
