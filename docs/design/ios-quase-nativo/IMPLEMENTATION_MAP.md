# Mapa de implementação

## Estratégia de ownership

O redesign não será implementado por múltiplos escritores simultâneos. O Claude mantém ownership exclusivo do código durante cada etapa. Agentes GPT trabalham como leitores independentes:

1. arquitetura e mapa de impacto;
2. fidelidade visual e sistema de design;
3. QA, acessibilidade e regressão.

Cada revisor entrega achados ao escritor; nenhuma edição concorrente é aplicada à mesma árvore.

## T0 — congelar a base

Bloqueia todas as etapas seguintes.

- Finalizar bugs e alterações que o Claude já está fazendo.
- Escolher a branch de integração correta.
- Registrar neste documento o SHA exato de partida.
- Exigir working tree limpo e testes atuais conhecidos.
- Criar um worktree novo, sugerido: `C:\Users\miguel\JobApp-Visual-iOS`.
- Criar a branch `design/ios-quase-nativo-prototype`.

**SHA aprovado:** `PENDENTE — preencher somente após o trabalho atual do Claude terminar.`

## T1 — contrato visual

Concluído por esta documentação. Antes de editar código, o escritor deve reler `README.md`, `DESIGN_SYSTEM.md` e `QA_CHECKLIST.md`.

## T2 — fundação do protótipo isolado

- Criar `app/dev-preview/ios/page.tsx`.
- Criar componentes somente em `components/ios-prototype/**`.
- Manter CSS/tokens restritos ao protótipo.
- Usar fixtures declaradas como exemplos, sem conectá-las a produção.
- Não modificar os componentes reais nesta etapa.

## T3 — shell e navegação

- Construir shell responsivo até 430 px.
- Reproduzir a barra flutuante atual com cinco destinos.
- Fazer o avatar abrir Ajustes.
- Preservar internamente o identificador e painel de Ajustes para evitar perda de estado.
- Validar área de toque, `aria-current`, foco e estados expandido/compacto.

## T4 — Início

- Aplicar a nova hierarquia de saudação, projeção, próximo atendimento, objetivos e narrativa de liberdade.
- Não inventar números nem esconder dados reais.
- Mapear as ações atuais antes de mover/remover o FAB.

## T5 — Agenda e Financeiro

- Agenda: preservar criação/edição de atendimento e estados existentes.
- Financeiro: preservar subtabs, filtros, entradas, saídas, metas e callbacks atuais.
- Realocar cada ação para o contexto correto antes de alterar o FAB global.

## T6 — Cofre e Rede

- Cofre: preservar PIN, proteção, upload, download, exclusão e privacidade.
- Rede: preservar feed, fotos, visualizador, curtidas, comentários, bloqueio, chat, paginação e estados de mídia.
- Não tocar em rotas, Supabase, migrations, middleware ou políticas nesta etapa visual.

## T7 — Ajustes, entrada, onboarding e PIN

- Ajustes abre pelo avatar e oferece caminho claro de volta.
- Preservar tema, conta, segurança e preferências atuais até decisão explícita.
- Harmonizar login/onboarding/PIN sem reescrever seus fluxos ou regras.

## T8 — aprovação visual obrigatória

- Capturar todas as telas e estados definidos no checklist.
- Comparar conceitualmente com os seis mockups.
- Corrigir inconsistências no protótipo.
- Parar e pedir aprovação humana.

Nenhuma mudança deve ser portada para o app real antes dessa aprovação.

## T9–T12 — portabilidade para o app real

Somente depois de T8:

- T9: introduzir tokens e primitives aprovados, com decisão explícita sobre temas.
- T10: portar shell, barra inferior e entrada de Ajustes.
- T11: portar Início, Agenda, Financeiro e Cofre em fatias testáveis.
- T12: portar Rede, Ajustes, login/onboarding/PIN.

Cada fatia deve preservar callbacks e testes funcionais existentes. Evitar um único PR gigante.

## T13 — regressão final

- Rodar typecheck, suíte completa e build.
- Executar checklist visual, acessível e funcional.
- Revisar o diff contra o SHA congelado.
- Não fazer merge ou deploy sem autorização explícita.

## Áreas protegidas durante o protótipo

Não editar durante T2–T8:

- `app/dev-preview/app/page.tsx`
- `styles/globals.css`
- `components/rede/FeedFotos.tsx`
- `components/rede/PostCard.tsx`
- `components/rede/RedeTab.tsx`
- `app/api/**`
- `lib/rede/**`
- `supabase/**`
- `middleware.ts`
- arquivos `.env*` e configurações Vercel

## Riscos conhecidos

- `app/page.tsx` concentra autenticação, PIN, painéis, formulários, sheets, FAB e onboarding; mudanças amplas ali têm alto raio de impacto.
- O avatar atual é decorativo e testes existentes podem proibir que seja clicável; atualizar esses testes deliberadamente ao mudar o contrato.
- Remover Ajustes da barra sem preservar seu painel pode perder estado e rotas internas.
- O FAB global representa ações diferentes por aba; removê-lo antes da migração de callbacks causa regressão silenciosa.
- Os temas atuais e o novo visual fixo vinho/rosa entram em conflito se a decisão não for tomada antes da portabilidade real.

