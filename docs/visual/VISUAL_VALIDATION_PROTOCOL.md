# Protocolo de validação visual (redesign iOS, mapa #122)

Ticket: [#133 — Validação, protocolo de captura visual confiável](https://github.com/alissonrsilva20bxx/cortex-app/issues/133).

Existe porque a validação visual das Fases 2–4 rodou contra um `next dev`
que sobreviveu, via hot-reload, a 8 commits — incluindo um deles ter sido
iniciado **antes de a branch existir**. O sintoma (BottomNav com um botão
"Ajustes" fantasma que o código já não tinha) só apareceu depois de matar
o processo e subir um servidor limpo. Diagnóstico completo:
[issue #132](https://github.com/alissonrsilva20bxx/cortex-app/issues/132).

Este protocolo garante que **nenhuma validação futura repita esse erro**.
Não é sobre código do produto — é processo. Segui-lo é obrigatório pra
qualquer ticket deste mapa que compare `/dev-preview/app` (app real, mock
harness) contra `/dev-preview/ios` (protótipo congelado aprovado).

## Regras não-negociáveis

- **Servidor sempre novo.** Nunca reaproveitar um `next dev` de uma sessão
  ou ticket anterior, mesmo que pareça estar rodando o código certo.
- **Nunca no deployment Vercel.** `/dev-preview/**` retorna 404 em Preview
  e Produção (achado #132, causa 1) — esse é um bug de infraestrutura
  separado, fora deste mapa, e este protocolo não depende dele ser
  corrigido. Tudo aqui roda **local**.
- **Mesmo HEAD para os dois lados.** App real e protótipo são comparados
  na mesma revisão de código, na mesma sessão de servidor — nunca um antes
  de um commit e o outro depois.
- **Sem editar arquivos durante a captura.** Entre `start-server.ps1` e
  `stop-server.ps1`, o worktree fica parado. Uma edição no meio do caminho
  reintroduz exatamente o problema de HMR que motivou este protocolo —
  se precisar editar algo, pare o servidor, edite, comece uma sessão nova.

## Passo a passo

### 1. Iniciar um servidor novo

```powershell
powershell -File scripts/visual-validation/start-server.ps1
# (ou `pwsh scripts/visual-validation/start-server.ps1`, se PowerShell 7 estiver instalado)
```

O script:

- recusa rodar se já existe uma sessão ativa rastreada (`.visual-validation/session.json`) — instrui a rodar `stop-server.ps1` primeiro;
- recusa rodar se a porta alvo (padrão 3101) já está em LISTEN por qualquer processo;
- recusa rodar em worktree sujo (a menos que `-AllowDirty`, só pra exploração descartável, nunca pra validar uma ticket de verdade);
- sobe `npm run dev -- -p <porta>` como processo novo;
- espera a porta abrir e **prova que quem está escutando é descendente do processo recém-lançado** (percorre a árvore de processos — não confia em "a porta abriu" sozinho);
- espera `/dev-preview/app` e `/dev-preview/ios` responderem 200;
- grava `.visual-validation/session.json` com worktree, branch, HEAD, git status, PID lançado, PID que está de fato escutando, porta, URL base, horário de início, caminho do log.

Confirme a saída do script antes de prosseguir — ela tem tudo que a
ticket precisa registrar (worktree/branch/HEAD/PID/horário/porta/URL).

### 2. Capturar as telas

Sem tooling de screenshot automatizado neste repo (sem Playwright como
devDependency) — a captura é feita por um agente Claude Code usando
ferramentas de browser já disponíveis no ambiente.

**Use `mcp__playwright__*`, não `mcp__claude-in-chrome__*`, para esta
etapa.** Validado na execução de prova deste protocolo (#133): o
`resize_window` da extensão Chrome redimensiona a _janela do SO_, não o
viewport CSS da página — pedir 390×844 produzia um viewport real de
~1707×820 (confirmado via `read_page`), inútil pra comparação por
tamanho de tela. `mcp__playwright__browser_resize` chama
`page.setViewportSize(...)` diretamente — viewport exato, confirmado nos
4 PNGs da execução de prova (`validation-captures/133/`).

Roteiro fixo por tela:

1. `mcp__playwright__browser_navigate` pra `http://localhost:<porta>/dev-preview/app` (app real).
2. `mcp__playwright__browser_resize` **390×844**, `mcp__playwright__browser_take_screenshot`.
3. `mcp__playwright__browser_resize` **430×932**, `mcp__playwright__browser_take_screenshot`.
4. Repetir 1–3 em `http://localhost:<porta>/dev-preview/ios` (protótipo),
   navegando até a mesma tela via os cliques equivalentes (as duas rotas
   têm estrutura de abas próxima, mas não idêntica — navegar manualmente,
   não assumir mesma coordenada de clique nas duas).
5. `browser_take_screenshot` salva relativo ao cwd do servidor MCP do
   Playwright, que pode não ser o worktree do redesign — mover/copiar os
   4 arquivos (real×390, real×430, proto×390, proto×430) pra
   `validation-captures/<ticket>/<YYYYMMDD-HHmmss>/<tela>__<viewport>__<real|proto>.png`
   — `<ticket>` é o número da ticket sendo validada (ex. `134` pra Início),
   `<tela>` um slug curto (`inicio`, `agenda`, `financeiro`, `cofre`, `pin`,
   `pin-cofre`, `rede-feed`, `perfil-proprio`, `perfil-publico`, `ajustes`).

Nota observada na execução de prova: a Início pode abrir com o sheet
"Seu recap do mês" por cima (estado de 1ª visita) — dispensar antes de
capturar, ou registrar deliberadamente se a captura for desse estado.

`validation-captures/` é local, gitignored — nunca commitar screenshots
neste repo.

### 3. Encerrar o servidor

```powershell
powershell -File scripts/visual-validation/stop-server.ps1
```

Mata o(s) PID(s) da sessão, confirma que a porta ficou livre, arquiva
`session.json` (com `stopped_at`) em `.visual-validation/archive/`, e
remove a sessão ativa — garantindo que a próxima chamada de
`start-server.ps1` não encontre nada pra reaproveitar.

## O que registrar na ticket ao fechar

Cole no comentário de resolução: worktree, branch, HEAD, PID lançado, PID
que respondeu (confirmado descendente), porta, URL base, horário de
início e de término — tudo já sai pronto no `session.json` de
`start-server.ps1`/`stop-server.ps1`, só copiar.

## Reprodutibilidade

Qualquer sessão/agente novo consegue rodar isto do zero: os dois scripts
não dependem de estado desta sessão (nenhuma variável de ambiente
implícita, nenhum PID hardcoded), só do worktree existir em
`C:\Users\miguel\JobApp-Redesign-iOS` (parametrizável via `-WorktreePath`)
e `npm install` já ter rodado ali.
