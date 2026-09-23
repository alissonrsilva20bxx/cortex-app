# Sistema visual iOS — fonte de verdade (redesign #122)

Versão: 1.0.0 — 2026-09-23
Origem: extraído de `components/ios-prototype/IosPrototypeApp.tsx` +
`components/ios-prototype/IosPrototypeApp.module.css` (protótipo congelado
`design/ios-quase-nativo-prototype`@`75cea20`), comparado linha a linha
contra `styles/globals.css` e os componentes reais na branch
`redesign/ios-quase-nativo`@`c8e3889`.

Este documento **não escolhe** cor, fonte ou direção estética — tudo abaixo
já foi aprovado no protótipo. Ele extrai os valores concretos e registra,
para cada um, se o app real já os usa. Nenhum valor aqui é inventado: onde
o protótipo não define algo (ex.: modo claro), isso está marcado
explicitamente como **derivado**, com a regra de derivação exposta.

## Causa raiz (por que o smoke de 22/09 reprovou)

`git diff 3832959..c8e3889 -- styles/globals.css` está vazio. As 8 tickets
corretivas (#134–#140) editaram telas individualmente, mas nenhuma tocou a
camada de tokens/materiais compartilhada. Como os primitivos mais reusados
do app (`GlassCard`, `BottomSheet`, `SegmentedControl`, `FilterChips`,
`Switch`, `BottomNav`) resolvem sua aparência a partir de `--surface`,
`--glow-sm`, `.glass-card` etc. definidos em `styles/globals.css`, e esses
tokens continuam sendo os de sempre (vidro neon com glow e blur pesado em
todo cartão), qualquer tela nova herda automaticamente a aparência antiga —
por mais que o _conteúdo_/estrutura daquela tela tenha sido migrado.
Confirmado por leitura direta: `.glass-card` (linha 481 de
`styles/globals.css`) ainda é `backdrop-filter: blur(20px)` + fundo
translúcido + `box-shadow` com glow em **todo** cartão; o `.card` do
protótipo (linha 290 do CSS do protótipo) é uma superfície opaca com
gradiente sutil, borda fina e sombra rasa, **sem blur nenhum** — blur no
protótipo é reservado para 4 elementos de chrome (barra inferior, cabeçalho
de sheet, topbar de perfil, aviso de protótipo), nunca para cartões de
conteúdo. É a divergência de maior alavancagem: um card usado em ~24
arquivos carregando a linguagem errada.

## Tipografia

| Token                      | Valor                                                                                                | Origem                                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--font-display` (títulos) | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif`          | `.prototypeStage` (linha 17) — **diferente** do `--font-display` atual do app (`var(--font-jakarta), "Plus Jakarta Sans", sans-serif`, `styles/globals.css:385`). O protótipo não usa nenhuma fonte de identidade separada — tudo é a pilha nativa do sistema. |
| `--font-body` (texto)      | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | Já idêntico entre app real (`styles/globals.css:381-383`) e `PinScreen.module.css:26-27`. Sem mudança necessária aqui.                                                                                                                                         |

**Divergência real**: o app usa Plus Jakarta Sans em `h1,h2,h3` (regra
global `styles/globals.css:388-392`) — uma fonte de identidade que o
protótipo **não tem**. Nenhuma tela do protótipo troca de família
tipográfica para títulos. Mudança necessária: parar de forçar
`--font-display` em `h1/h2/h3` globalmente; manter a pilha nativa em toda
a hierarquia iOS. Plus Jakarta Sans, se mantida, fica reservada para uso
pontual de marca (ex.: tela de login/onboarding fora do mockup principal),
nunca para telas do app principal.

### Escala de tamanhos (extraída, por papel)

| Papel                            | Tamanho            | Peso                        | Letter-spacing | Line-height | Onde aparece no protótipo                                         |
| -------------------------------- | ------------------ | --------------------------- | -------------- | ----------- | ----------------------------------------------------------------- |
| Título de tela grande            | 35px (28px <390px) | 760                         | -0.035em       | 1.12        | `.titleHeader h1`, `.networkHeader h1`, `.stateScreen>h1`         |
| Título de saudação (Início)      | 30px (28px <390px) | 760                         | -0.035em       | 1.12        | `.greetingHeader h1`                                              |
| Título de PIN                    | 34px (26px curto)  | ~620–700                    | -0.04em        | 1.05        | `.pinIntro h1` (real: `PinScreen.module.css:129-136`, já portado) |
| Título de card                   | 20–23px            | 400–700 (variável por card) | -0.02em        | normal      | `.card h2` (20), `.protectedCard h2`/`.agendaIntro h2` (23)       |
| Título de sheet                  | 21px               | 400                         | -0.02em        | normal      | `.sheetHeader h2`                                                 |
| Título de lista/seção grande     | 24px               | 400                         | normal         | normal      | `.listTitle`                                                      |
| Métrica grande (saldo, projeção) | 35–48px            | 400                         | -0.04em        | 1           | `.bigMetric` (48), `.balanceLine>strong` (35)                     |
| Corpo                            | 14–16px            | 400                         | normal         | 1.45        | `.card p`, `.post>p`, `.pinIntro p`(13px)                         |
| Rótulo de seção (uppercase)      | 11px               | 600                         | 0.16em         | normal      | `.settingsSection>h2`                                             |
| Metadado/legenda                 | 10–13px            | 400–650                     | normal         | normal      | `.jobInfo span`, `.movementText small`                            |

**Divergência real confirmada**: `components/home/GreetingHeader.tsx:44`
define o título da Início como **17px / font-semibold(600) / -0.035em**,
com um comentário explícito no código dizendo que é intencionalmente
"mais discreto" que uma versão anterior de 27px. O protótipo aprovado usa
**30px / 760 / -0.035em** para o mesmo elemento — quase o dobro do
tamanho, com peso mais pesado. Isso não é uma diferença de detalhe: é a
saudação da tela mais visitada do app renderizando na escala tipográfica
errada, por decisão deliberada anterior ao protótipo que nunca foi
revisitada.

### Pesos (mapeamento para o que os navegadores realmente aplicam)

O protótipo usa pesos "off-scale" (620, 650, 700, 720, 760) que dependem de
fonte variável (SF Pro em Safari/iOS suporta; a pilha de fallback em
Windows/Chrome não). Regra de derivação: manter o valor literal do
protótipo no CSS (não arredondar para 400/700) — em motores sem suporte a
peso variável, o navegador já faz o "nearest match" automaticamente
(ex.: 760 vira 700 visualmente), então declarar o valor exato não quebra
nada e preserva a intenção em quem suporta.

| Peso nominal |                                                         Uso |
| ------------ | ----------------------------------------------------------: |
| 400          |                                        corpo, textos padrão |
| 500          |                       rótulos de segmento inativo, legendas |
| 520          |                                   dígitos do teclado do PIN |
| 600          |                rótulo de seção uppercase, `sheetForm label` |
| 650          |                   badges pequenos, toast, `sheetForm label` |
| 700          | botões primários/secundários, texto ativo de segmented/chip |
| 720          |                               mini-rótulo do teclado do PIN |
| 760          |                                títulos de tela (h1 grandes) |

## Cores

### Semânticas de marca (herdadas do sistema de 8 temas — não mexer)

O protótipo hardcoda um único acento (`--p-accent:#ff2d78`), que é
**exatamente** o mesmo hex do tema `pink-neon` já existente em
`styles/globals.css:35`. Isso confirma que o protótipo não substitui o
sistema de 8 temas do app — ele documenta a aparência _estrutural_ (o
"chrome" iOS) usando um tema como amostra. Ajustes continua com "temas
existentes e claro/escuro" no contrato de paridade — **não remover os 8
temas nem o `--accent` variável por tema**. O que muda é tudo que hoje é
material/estrutura (cards, blur, radius, sombra) e hoje está hardcoded
como se fosse tema, quando deveria ser neutro e só emprestar `--accent`.

### Estados/semântica funcional

| Token                  | Prototype                                                                                                                 | App atual (escuro)          | Divergência                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sucesso                | `#6be792` / `rgba(83,215,123,*)`                                                                                          | `--success:#50dc78`         | próximo, tom mais claro no protótipo — ajustar para `#53d77b` (média)                                                                                                                                             |
| Perigo                 | `#ff6374` / `#ff5a6b` / botão destrutivo `#d9384e`                                                                        | `--danger:#ff5a5a`          | próximo o suficiente — manter                                                                                                                                                                                     |
| Atenção/valor pendente | **`#ff9f0a`** (laranja sistema iOS)                                                                                       | `--warning:#ffb020` (âmbar) | matiz diferente — protótipo usa o laranja de sistema iOS para valores financeiros pendentes/agendados (`.jobValue strong`, `.timelineDetails strong`); app usa âmbar. Ajustar `--warning` para `#ff9f0a` (escuro) |
| Informação             | não usado como semântica no protótipo (roxo `#bc7bff` aparece só como cor decorativa de ícone de arquivo-imagem no Cofre) | `--info:#64b4ff`            | manter `--info` como está; **não** confundir com o roxo do Cofre — esse é um acento de tipo-de-arquivo, não status                                                                                                |

### Fundos e superfícies (modo escuro — extraído 1:1)

| Token novo             | Valor                                                                        | Uso no protótipo                                                              |
| ---------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `--ios-bg-deep`        | `#080004` (~ tom análogo por tema: usar `rgb(var(--bg-rgb) / 1)` escurecido) | fundo mais profundo (base do phoneShell)                                      |
| `--ios-surface-card`   | `linear-gradient(145deg, rgba(255,255,255,0.058), rgba(255,255,255,0.025))`  | `.card` — substitui o `.glass-card` atual como material de cartão de conteúdo |
| `--ios-surface-row`    | `rgba(255,255,255,0.035)` a `rgba(255,255,255,0.045)`                        | trilhos (`.weekStrip`, `.searchBox`, `.composerPrompt`, `.segmented`)         |
| `--ios-surface-chrome` | `rgba(16,1,7,0.72)` (≈ `rgb(var(--bg-rgb) / 0.72)`)                          | bottom nav, sheet header, profile topbar — os **únicos** 4 lugares com blur   |
| `--ios-border`         | `rgba(255,255,255,0.095)` (`--p-border`)                                     | toda borda de card/trilho/divisor                                             |

Regra de derivação para claro: **o protótipo não tem modo claro** — ele é
fixo-escuro. Isso é uma lacuna real do protótipo em relação ao app (que
tem claro/escuro em Ajustes, contrato de paridade explícito). Decisão
tomada por leitura do padrão já estabelecido no próprio
`styles/globals.css:319-339` (bloco `[data-mode="light"]` já existe e já
faz exatamente essa transformação para o `.glass-card` de hoje): inverter
polaridade das superfícies translúcidas (branco→preto), manter a MESMA
estrutura geométrica (mesmo raio, mesmo espaçamento, mesma composição),
mesma cor de acento por tema, e re-derivar apenas contraste. Isso não é
uma nova escolha estética — é a extensão mecânica de uma transformação que
o código já faz para o material antigo, aplicada ao novo material do
card. Registrado aqui como derivado, não aprovado visualmente pelo
protótipo; se o smoke final achar que o claro do Cofre/Financeiro
"não parece iOS", isso volta como ambiguidade genuína (Parte 5) — não
antes disso.

## Materiais e blur (a divergência mais importante)

O protótipo usa blur em exatamente 4 lugares — nunca em cartões de
conteúdo:

1. `.bottomNav` — `blur(20px)`, fundo `rgba(16,1,7,0.72)`.
2. `.sheetHeader` (cabeçalho fixo dentro de um sheet) — `blur(18px)`,
   fundo `rgba(34,11,20,0.94)`.
3. `.profileTopbar` (topo fixo do perfil) — `blur(18px)`, fundo
   `rgba(17,2,8,0.88)`.
4. `.prototypeNotice` (chrome do próprio protótipo, não migra) —
   `blur(18px)`.

Todo o resto — `.card`, `.nextJob`, `.searchBox`, `.movement`,
`.fileRow`, `.timelineCard`, `.sheetForm input` — é opaco ou
semi-opaco **sem** `backdrop-filter`. O app real hoje aplica
`backdrop-filter: blur(20px)` a **qualquer** `.glass-card`
(`styles/globals.css:483-484`), ou seja, a todo cartão de conteúdo do
app inteiro. Esse é o "PWA feel" que o usuário está reportando: o
material errado (vidro fosco pesado em tudo) em vez do material certo
(superfícies opacas com blur reservado a navegação/headers fixos).

**Mudança necessária**: `.glass-card` deixa de ter `backdrop-filter`.
Blur passa a existir só em `BottomNav.tsx` (já tem), e em headers
sticky que ainda não existem como componente compartilhado (ver tabela
de sheets/headers abaixo — candidato a extrair um `StickyHeader`
component se o padrão se repetir em Perfil próprio/público e sheets
grandes).

## Bordas

Espessura universal: `1px`. Cor universal (escuro):
`rgba(255,255,255,0.095)` para bordas neutras de card/trilho, e
`rgb(var(--accent-rgb) / 0.14–0.3)` para bordas com tom de destaque
(chip ativo de contorno, seal do PIN, bottom nav). O app real já usa
essa convenção de `1px solid var(--border-color)` na maioria dos
primitivos (`BottomSheet`, `Switch`) — **sem divergência estrutural
aqui**, só o valor de `--border-color` herda do material errado
indiretamente via tema.

## Sombras e profundidade

| Nível                             | Prototype                                                                                   | Uso                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Nível 0 (plano)                   | nenhuma sombra                                                                              | trilhos, chips, linhas de lista                 |
| Nível 1 (card)                    | `inset 0 1px 0 rgba(255,255,255,0.025), 0 14px 34px rgba(0,0,0,0.14)`                       | `.card`                                         |
| Nível 2 (botão primário/destaque) | `0 9-10px 26-28px rgba(255,45,120,0.2-0.25)` (sombra colorida com o `--accent`, não neutra) | `.primaryButton`, `.addButton`, `.sheetPrimary` |
| Nível 3 (flutuante/nav)           | `0 16px 40px rgba(0,0,0,0.45)`                                                              | `.bottomNav`                                    |
| Nível 4 (sheet)                   | `0 -18px 58px rgba(0,0,0,0.48)`                                                             | `.sheet`                                        |

Divergência: o app real usa `--glow` / `--glow-sm` (sombras difusas tipo
neon, ex. `0 0 28px rgba(accent,0.25), 0 0 6px rgba(accent,0.12)`,
`styles/globals.css:21-22`) em vez de sombras direcionais de elevação
(deslocamento em Y, blur maior, sem "auréola"). O glow decorativo deve
sumir de cards/segmented/switch/chips — a única sombra colorida que o
protótipo mantém é a do **botão de ação primária** (`.primaryButton`,
`.sheetPrimary`, `.addButton`), que é elevação real (offset em Y), não
glow radial. `--glow`/`--glow-sm` como conceito (auréola neon)
**não existe no protótipo em nenhum elemento** — deve ser removido de
`BottomNav`/`SegmentedControl`/`FilterChips`/`Switch`, substituído por
elevação de botão primário nesses casos onde fizer sentido (ex.: aba
ativa da bottom nav pode manter _alguma_ sombra, mas direcional e
discreta, não glow difuso de 28-40px).

## Espaçamento

Escala observada (não é um grid rígido de 4/8pt puro, mas converge em
múltiplos de ~2-4px): `4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18,
20, 22`. Paddings de tela: `20px` (padrão), `16-18px` (<390px ou feed).
Gaps de grid comuns: `10-14px`. Não há token de espaçamento centralizado
hoje em nenhum dos dois lados — aceitar isso como está (Tailwind
utilitário resolve na prática); não é uma ambiguidade que bloqueia nada.

## Raios (ajuste de escala, não substituição)

| Token atual     | Valor atual | Valor real observado no protótipo                              | Ação                                                                                                                          |
| --------------- | ----------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--radius-sm`   | 12px        | inputs de sheet = 14px                                         | subir para 14px                                                                                                               |
| `--radius-md`   | 16px        | botões primário/secundário = 16px; `nextJob`/trilhos = 17-18px | manter 16px pra botão; usar `--radius-lg` pros cartões menores tipo nextJob                                                   |
| `--radius-lg`   | 20px        | cards de conteúdo (`.card`) = 22px                             | subir para 22px                                                                                                               |
| `--radius-xl`   | 24px        | topo do sheet = 26px                                           | **novo token** `--radius-sheet: 26px`; `--radius-xl` pode ficar 24px pra outros usos (ex. avatar grande quadrado, se existir) |
| `--radius-pill` | 999px       | chips, segmented outer, bottom nav, badges                     | sem mudança                                                                                                                   |

## Ícones

Já alinhado: ambos os lados usam **lucide-react**. Convenção confirmada
idêntica em código real (`components/BottomNav.tsx:92`) e protótipo
(`IosPrototypeApp.tsx:309`): `size={20} strokeWidth={active ? 2.3 : 1.8}`
para ícones de navegação — **sem divergência**, já portado corretamente
na Fase 1 (#124). Fora da navegação, o protótipo usa ícones em roundels
(círculo de fundo tonal, ex. `.settingIcon` 38px/`.roundIcon` 52px/
`.stateIcon` 72px) com `strokeWidth` padrão do lucide (2) — manter como
está fora da bottom nav; não há um segundo padrão de espessura a
extrair além do par 1.8/2.3 já em uso.

## Componentes

### Botões

- Primário: altura mín. 48px, `border-radius:16px`, fundo
  `linear-gradient(135deg, var(--accent), <variante mais clara>)`,
  texto branco 700, sombra colorida nível 2. **Não existe componente
  compartilhado hoje** — 32 arquivos reimplementam com Tailwind
  ad-hoc (`rounded-2xl py-3.5...`). Não vira bloqueio da Fundação:
  documentado aqui como padrão de referência; aplicado tela a tela nas
  tickets de migração (menor risco que uma varredura de 32 arquivos de
  uma vez, e cada tela já será revalidada visualmente de qualquer forma).
- Secundário: mesma altura/raio, fundo `rgb(accent/0.09)`, borda
  `rgb(accent-soft/0.25)`, texto na cor do acento.
- Texto/terciário (`.textButton`): sem fundo, cor do acento, 700.

### Inputs (`.sheetForm input/textarea`, `.sheetSearch`)

Altura mín. 52px, `border-radius:14px`, borda `1px solid var(--p-border)`,
fundo `rgba(255,255,255,0.055)`, foco: borda `rgb(accent-soft/0.6)` +
anel `0 0 0 3px rgb(accent/0.12)`. Compare com o app real: já não há
componente de input compartilhado (mesmo padrão dos botões) — tratar
junto de cada tela no momento da migração.

### Cards (`GlassCard.tsx` + `.glass-card`)

Ver seção "Materiais e blur" acima — é o item #1 da Fundação. API do
componente (`radius`, `as`, `onClick`) não muda; só o CSS de
`.glass-card` e o `RADIUS` map (que já vai herdar o ajuste de raio).

### Segmented controls (`SegmentedControl.tsx`)

Estrutura já correta (trilho + pílula ativa). Divergência: usa
`var(--glow-sm)` na aba ativa (linha 58) — protótipo não tem glow em
`.segmented .segmentActive`, só `linear-gradient` de fundo + peso 700.
Remover o `boxShadow` de glow.

### Sheets (`BottomSheet.tsx`)

Estrutura já correta (handle, header sticky, footer, focus trap —
inclusive mais robusta que o protótipo em acessibilidade, que é
mock). Divergências pontuais:

- raio do topo: `--radius-xl` (24px) vs `--radius-sheet` novo (26px);
- fundo: `var(--surface-2)` (translúcido genérico do tema) vs
  gradiente específico do protótipo
  (`linear-gradient(180deg, #220b14, #12040a 70%)`, análogo por tema:
  `linear-gradient(180deg, rgb(var(--bg-rgb)/0.96), rgb(var(--bg-rgb)/0.99) 70%)`);
- overlay de fundo: `blur(6px)` + `rgb(var(--bg-rgb)/0.55)` (linha 109-111)
  vs protótipo `rgba(0,0,0,0.62)` sem blur (`.sheetBackdrop`) — o
  protótipo escurece com preto puro atrás do sheet, sem borrar o
  conteúdo por trás. Ajustar.

### Headers (saudação, título de tela, topbar de perfil)

Ver tipografia acima — o gap mais visível do app (`GreetingHeader`).
`.titleHeader`/`.networkHeader` (Agenda/Financeiro/Rede) precisam do
mesmo tratamento — conferir tela a tela na migração.

### Navegação inferior (`BottomNav.tsx`)

Já é o componente **mais próximo** do protótipo hoje (confirmado
comparando os dois blocos de CSS: blur 20px, borda accent/0.14, fundo
`rgb(bg/0.72)` batem). Único ajuste: `boxShadow: var(--glow-sm)` no
botão ativo (linha 89) é glow difuso; protótipo usa
`0 0 18px rgba(accent,0.4)` — mais parecido a uma elevação suave, sem
o "halo" duplo do `--glow-sm` atual (`0 0 14px + inset`). Ajuste fino,
não estrutural.

### Estados interativos

| Estado       | Regra do protótipo                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pressionado  | `transform: scale(0.92-0.99)` + escurece/ilumina levemente o fundo, sem delay — ex. `.pinKeypad>button:active`, `.glass-card:active` (já existe!) |
| Selecionado  | preenchimento sólido do acento + texto branco 700 (segmented/chip/dia da semana/tab)                                                              |
| Desabilitado | `opacity:0.62` (`.pinKeypad>button:disabled`)                                                                                                     |
| Carregando   | shimmer: gradiente translúcido varrendo da esquerda pra direita, 1.35s infinito (`.loadingCard::after`), sobre bloco `rgba(255,255,255,0.055)`    |

### Safe areas

Já corretamente tratado em ambos os lados via `env(safe-area-inset-*)`
e `100dvh` — ver `styles/globals.css:410-415` (comentário já explica a
armadilha do 100vh em PWA standalone) e `.screenContent`/`.bottomNav`/
`.homeIndicator` no protótipo. **Sem divergência** — não é item de
trabalho da Fundação.

### Movimento e transições

| Transição                       | Timing do protótipo                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Sheet subindo                   | `260ms cubic-bezier(0.2, 0.85, 0.25, 1)` (`sheetRise`)                                       |
| Backdrop de sheet               | `180ms ease-out` fade                                                                        |
| Bottom nav (compactar/expandir) | `220ms cubic-bezier(0.2, 0.8, 0.2, 1)` — **já idêntico** no app real (`BottomNav.tsx:69-70`) |
| Dot do PIN preenchendo          | `180ms cubic-bezier(0.16, 1, 0.3, 1)` — **já portado** (`PinScreen.module.css:161-164`)      |
| Tecla do PIN pressionada        | `120ms ease` — **já portado**                                                                |
| `prefers-reduced-motion`        | reduz tudo para `0.01ms` — **já existe nos dois lados**                                      |

Sem divergência de motion na fundação — os timings que já foram
portados (PIN, bottom nav) devem ser reaproveitados como referência
para qualquer transição nova (sheet, segmented, card), não reinventados.

### Feedback tátil

O protótipo não implementa vibração (é mock de navegador). Não criar
`navigator.vibrate` novo só por isso — fora do escopo funcional
aprovado; feedback tátil real, se existir hoje no app, preservar como
está.

## Matriz obrigatória — Fundação Visual

| Elemento do protótipo                       | Implementação atual                                      | Divergência encontrada                                                                                   | Mudança necessária                                                                | Token/componente responsável                                         | Telas consumidoras                                        | Critério objetivo de aceite                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.card` (material de cartão)                | `.glass-card` (`styles/globals.css:481-512`)             | Blur pesado (20px) + glow em todo cartão vs superfície opaca com gradiente sutil e sombra rasa, sem blur | Remover `backdrop-filter`; trocar fundo/sombra pelo material `.card` do protótipo | `.glass-card` em `styles/globals.css`, consumido por `GlassCard.tsx` | 24 arquivos (todas as telas com card)                     | Nenhum `.glass-card` renderizado tem `backdrop-filter` computado ≠ `none`, exceto os 4 elementos de chrome listados                              |
| `.greetingHeader h1` (título Início)        | `GreetingHeader.tsx:41-50`                               | 17px/600/-0.035em vs 30px/760/-0.035em aprovado                                                          | Subir escala tipográfica pro valor aprovado                                       | `components/home/GreetingHeader.tsx`                                 | Início                                                    | Título computado ≥28px (viewport <390) / 30px (≥390), peso ≥700 efetivo                                                                          |
| `h1,h2,h3{font-family:var(--font-display)}` | `styles/globals.css:388-392`                             | Força Plus Jakarta Sans em toda a hierarquia; protótipo usa só a pilha nativa                            | Remover a regra global; nativa em todo o app principal                            | `styles/globals.css`                                                 | Todas                                                     | Nenhum h1/h2/h3 do app principal computa `font-family` com Jakarta; login/onboarding fora do escopo desta regra podem manter se decidido à parte |
| `--warning`                                 | `styles/globals.css:350` (`#ffb020`)                     | Âmbar vs laranja de sistema iOS (`#ff9f0a`) usado em valores financeiros pendentes                       | Trocar hex nos 8 temas (escuro) e light override                                  | `styles/globals.css` tokens `--warning`/`--warning-rgb`              | Agenda (valor do atendimento), Financeiro (pendências)    | `--warning` computado = `#ff9f0a` em pelo menos um tema testado                                                                                  |
| `.segmented .segmentActive` boxShadow       | `SegmentedControl.tsx:58` (`var(--glow-sm)`)             | Glow difuso vs sem sombra (só gradiente+peso)                                                            | Remover `boxShadow` do estado ativo                                               | `components/ui/SegmentedControl.tsx`                                 | Financeiro, Agenda, Ajustes (todo consumidor do controle) | Aba ativa sem `box-shadow` computado (ou `none`)                                                                                                 |
| `.sheetBackdrop`                            | `BottomSheet.tsx:106-114` (`blur(6px)` + `rgb(bg/0.55)`) | Protótipo não borra o conteúdo atrás do sheet, só escurece (`rgba(0,0,0,0.62)`)                          | Remover blur do backdrop; usar preto semi-opaco                                   | `components/ui/BottomSheet.tsx`                                      | Todo sheet do app (~18 consumidores)                      | Backdrop sem `backdrop-filter` computado                                                                                                         |
| Raio do topo do sheet                       | `--radius-xl` = 24px                                     | Protótipo usa 26px                                                                                       | Novo token `--radius-sheet:26px`, aplicar no `BottomSheet.tsx`                    | `styles/globals.css` + `BottomSheet.tsx`                             | Todo sheet                                                | `border-top-left-radius`/`right` computado = 26px                                                                                                |
| `--radius-lg` (cards)                       | 20px                                                     | Protótipo usa 22px pro `.card`                                                                           | Subir `--radius-lg` para 22px                                                     | `styles/globals.css`                                                 | Todas (GlassCard consumidores com `radius="lg"`, padrão)  | Raio computado do `.glass-card` padrão = 22px                                                                                                    |
| `--radius-sm` (inputs)                      | 12px                                                     | Protótipo usa 14px                                                                                       | Subir `--radius-sm` para 14px                                                     | `styles/globals.css`                                                 | Formulários com inputs em `--radius-sm`                   | Raio computado = 14px                                                                                                                            |
| Bottom nav — sombra do botão ativo          | `BottomNav.tsx:89` (`var(--glow-sm)`)                    | Glow duplo (halo + inset) vs elevação simples `0 0 18px rgba(accent,0.4)`                                | Trocar por sombra única, sem inset                                                | `components/BottomNav.tsx`                                           | Barra inferior (global)                                   | Sombra computada do botão ativo é uma única `box-shadow`, sem componente `inset`                                                                 |

## Telas já confirmadas fora de retrabalho amplo desta fundação

Rede/feed, Ajustes e PIN (geral + Cofre) — per histórico do mapa #122 e
handoff de 23/09 — já bateram visualmente linha a linha com o protótipo
em revisão anterior. Elas **herdam automaticamente** os ajustes de
`.glass-card`/`SegmentedControl`/`BottomSheet` acima (são consumidoras
dos mesmos primitivos) e por isso **precisam ser revalidadas no smoke
final como regressão**, não remigradas — um ajuste de token compartilhado
pode ter mudado a aparência delas incidentalmente, e é exatamente isso
que a comparação final vai confirmar ou reprovar.

## Regra permanente para todo o mapa

- Funcionalidade preservada **não** é aceite visual.
- Estrutura semelhante **não** é aceite visual.
- Testes verdes **não** são aceite visual.
- Uma tela só é considerada migrada depois de comparação visual real
  contra `/dev-preview/ios`, sob o protocolo de servidor limpo (#133),
  nos dois viewports (390×844, 430×932) e nos dois modos (claro/escuro)
  aplicáveis.
