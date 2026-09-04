# Evidências soltas organizadas — 2026-09-04

Screenshots que estavam na raiz do repo (gerados por sessões manuais de QA
via Playwright/browser entre 21 e 25/08), organizados aqui por origem.
Nenhum arquivo foi apagado — só movido. Nenhum destes está referenciado por
código ou teste; são só registro visual.

## `t14-bottomnav-fechado/` — pode apagar

Evidência de QA do T14/#67 (fluidez do BottomNav ao trocar de aba). Ticket
fechado, PR #95 mergeado em `mockuptesterede` em 2026-08-21. A decisão já
está no código; estes PNGs não são mais necessários como prova.

## `t70-onboarding-fechado/` — pode apagar

Evidência de QA do T17/#70 (onboarding com contas reais, ponta-a-ponta:
login → onboarding → PIN → reload). Ticket fechado, PR #99 mergeado em
2026-08-21. Mesma situação do T14: decisão já implementada e testada,
screenshots são só histórico.

## `pin-prototype-pausado/` — manter por enquanto

3 variantes (B) do protótipo de redesign da tela de PIN
(`components/pin/prototype/`). Trabalho **pausado**, não decidido — variante
B foi escolhida como direção mas descrita como "genérica", verificação via
Figma interrompida. Não mexer nisso agora (fora de escopo desta rodada:
"não redesenhe... PIN"). Manter até o protótipo ser retomado ou descartado
por decisão explícita.

## `login-feed-24ago/` — status indefinido, não apagar sem checar

6 arquivos de uma sessão de 24/08 (`login-fix-check`, 3 variantes de login,
2 do feed). Não há um ticket fechado claramente associado — pode estar
ligado ao "mistério da dessaturação no login" (adiado 2026-08-20, sem causa
encontrada) ou a uma exploração visual que não virou decisão. Recomendo
perguntar antes de apagar.

## `verificacao-2026-09-04/` — evidência desta rodada de consolidação

2 screenshots do `/dev-preview/app` rodando localmente depois da remoção do
`LoadingScreen` (commit `c367fa9`) — confirma visualmente que o conteúdo
aparece completo, sem tela em branco, tanto no primeiro load quanto num
reload dentro da mesma aba. Ver `docs/beta/SMOKE_TEST_CHECKLIST.md` e o
relatório desta sessão pra contexto completo, inclusive uma ressalva sobre
uma janela teoricamente possível (não observada aqui, porque o mock local
responde instantâneo e não replica a latência real do Supabase).

## `.playwright-mcp/` (raiz do repo, fora desta pasta)

Diretório separado, não movido para cá de propósito — não é evidência
selecionada, é cache bruto de ferramenta (176 arquivos: logs de console e
snapshots de acessibilidade `.yml`/`.png` do Playwright MCP, 21–25/08).
Adicionado ao `.gitignore` nesta mesma sessão. Seguro apagar a pasta
inteira quando quiser recuperar o espaço.
