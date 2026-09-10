import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização, mesmo padrão dos outros
 * `*-visual.test.ts`): confirma pelo código-fonte que a apresentação de
 * fotos no feed segue a direção aprovada — foto grande no card, estilo
 * Instagram, interação iOS — e que as restrições combinadas continuam de
 * pé:
 *
 *  - `PostCard` renderiza o `FeedFotos` real (não a grade de miniatura
 *    antiga com `object-cover`, que cortava a foto);
 *  - foto sangra a largura do card, SEM borda/sombra/raio próprio;
 *  - carrossel = scroll-snap nativo; principal com `loading="lazy"`
 *    (sob demanda, não antecipada de todos os posts);
 *  - SEM setas permanentes no touch (só `@media (hover:hover) and
 *    (pointer:fine)`); indicador de página discreto;
 *  - SEM animação de altura (a foto legada assenta de uma vez);
 *  - limites de proporção do feed orgânico do Instagram (1.91:1 … 3:4);
 *  - a foto do feed NÃO é interativa: tocar não abre modal/fullscreen/
 *    página/visualizador (decisão 2026-09-10, PR #112 — o `FotoViewer` foi
 *    retirado do feed; sem `role="button"`, foco por teclado ou cursor de
 *    clique na foto);
 *  - `prefers-reduced-motion` respeitado no scroll programático.
 *
 * O projeto não tem RTL/JSX no vitest — ler o arquivo como texto pega o
 * mesmo tipo de regressão (import trocado, `object-cover` de volta,
 * transição de altura reintroduzida, seta vazando no touch, semântica de
 * botão/handler de abrir visualizador de volta na foto).
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("PostCard usa o FeedFotos real", () => {
  const postCard = read("components/rede/PostCard.tsx");

  it("importa FeedFotos do caminho real", () => {
    expect(postCard).toMatch(
      /import\s*{\s*FeedFotos\s*}\s*from\s*"\.\/FeedFotos"/
    );
  });

  it("renderiza <FeedFotos> quando o post tem fotos", () => {
    expect(postCard).toMatch(/<FeedFotos[\s\S]*?fotos=\{post\.fotos\}/);
  });

  it("não voltou a usar a grade de miniatura com object-cover (que cortava)", () => {
    expect(postCard).not.toMatch(/object-cover/);
    expect(postCard).not.toMatch(/grid-cols-2[\s\S]*PostPhoto/);
  });

  it("não passa mais handler de abrir visualizador pro FeedFotos", () => {
    // decisão 2026-09-10: foto no feed não abre nada
    expect(postCard).not.toMatch(/onAbrirViewer/);
    expect(postCard).not.toMatch(/FotoViewer/);
  });
});

describe("FeedFotos — direção iOS + Instagram", () => {
  const f = read("components/rede/FeedFotos.tsx");

  it("foto sangra a largura do card (margem negativa) e sem raio/sombra/borda própria", () => {
    expect(f).toMatch(/marginLeft:\s*-16/);
    expect(f).toMatch(/marginRight:\s*-16/);
    expect(f).not.toMatch(/boxShadow/);
    // a faixa da foto (helper `bleed`) não pode ter borda nem raio próprio
    const bleedBody = f.match(/const bleed =[\s\S]*?\}\);/)?.[0] ?? "";
    expect(bleedBody).toBeTruthy();
    expect(bleedBody).not.toMatch(/borderRadius/);
    expect(bleedBody).not.toMatch(/border:/);
  });

  it("fundo neutro é var(--bg), object-contain (foto inteira, sem corte/distorção)", () => {
    expect(f).toMatch(/background:\s*"var\(--bg\)"/);
    expect(f).toMatch(/objectFit:\s*"contain"/);
    expect(f).not.toMatch(/objectFit:\s*"cover"/);
  });

  it("carrossel usa scroll-snap nativo", () => {
    expect(f).toMatch(/scrollSnapType:\s*"x mandatory"/);
    expect(f).toMatch(/scrollSnapAlign:\s*"start"/);
    expect(f).toMatch(/scrollSnapStop:\s*"always"/);
    expect(f).toMatch(/feed-foto-scroller/);
  });

  it("a principal só é montada quando o card entra na viewport (IntersectionObserver)", () => {
    expect(f).toMatch(/new IntersectionObserver/);
    expect(f).toMatch(/rootMargin:\s*"200px 0px"/);
    expect(f).toMatch(/setNaViewport\(true\)/);
    expect(f).toMatch(/io\.disconnect\(\)/); // uma vez perto, fica montada
    // a <img> da principal só renderiza quando renderPrincipal é true
    expect(f).toMatch(/renderPrincipal\s*&&\s*!principalFalhou\s*&&\s*url/);
    // foto única: gate pela viewport
    expect(f).toMatch(/renderPrincipal=\{naViewport\}/);
    // loading=lazy fica como reforço
    expect(f).toMatch(/loading="lazy"/);
  });

  it("carrossel: a principal do slide só monta quando ele foi ativado (deslizado até)", () => {
    expect(f).toMatch(/renderPrincipal=\{naViewport && ativados\.has\(i\)\}/);
    expect(f).toMatch(/setAtivados/);
    expect(f).toMatch(/new Set\(\[0\]\)/); // só o 1º slide começa ativo
  });

  it("a foto do feed NÃO é interativa: não abre modal/fullscreen/página/visualizador", () => {
    // decisão 2026-09-10: o visualizador interno saiu do feed (PR #112).
    // ignora os comentários pra não casar com a nota que explica a remoção.
    const semComentarios = f
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "");
    expect(semComentarios).not.toMatch(/onAbrir/);
    expect(semComentarios).not.toMatch(/FotoViewer/);
    // nenhuma semântica de botão / ação invisível por teclado no palco
    expect(semComentarios).not.toMatch(/role="button"/);
    expect(semComentarios).not.toMatch(/onKeyDown/);
    expect(semComentarios).not.toMatch(/tabIndex/);
    // sem detecção de "tap vs swipe" (existia só pra decidir se abria)
    expect(semComentarios).not.toMatch(/Math\.hypot/);
    expect(semComentarios).not.toMatch(/\bandou\b/);
  });

  it("carrossel continua com swipe horizontal nativo e pontinhos abaixo", () => {
    expect(f).toMatch(/scrollSnapType:\s*"x mandatory"/);
    expect(f).toMatch(/indicador de página/i);
  });

  it("usa a memória de proporções das fotos legadas (localStorage)", () => {
    expect(f).toMatch(
      /import\s*{[\s\S]*?proporcaoLembrada[\s\S]*?}\s*from\s*"@\/lib\/rede\/fotoRatioMemoria"/
    );
    expect(f).toMatch(/proporcaoLembrada\(foto0\.thumbPath\)/);
    expect(f).toMatch(/lembrarProporcao\(foto0\.thumbPath/);
  });

  it("setas só via classe .feed-foto-seta (escondidas no touch por CSS)", () => {
    expect(f).toMatch(/className="feed-foto-seta"/);
    // nada de setas sempre visíveis / dependentes de estado de hover em JS
    expect(f).not.toMatch(/onMouseEnter|onMouseOver/);
    // o style inline das setas (setaBase) NÃO pode setar `display`: um
    // display inline vence a media query `.feed-foto-seta` por
    // especificidade e as setas vazam pro touch (regressão real do iPhone).
    const setaBase = f.match(/const setaBase[\s\S]*?\n};/)?.[0] ?? "";
    expect(setaBase).not.toMatch(/display\s*:/);
  });

  it("indicador de página é discreto e fica ABAIXO da foto (fora da bleed box)", () => {
    expect(f).toMatch(/indicador de página/i);
    expect(f).toMatch(/paddingTop:\s*8/);
  });

  it("NÃO anima a altura (foto legada assenta de uma vez)", () => {
    expect(f).not.toMatch(/transition:\s*"height/);
    expect(f).not.toMatch(/height\s+\d+ms/);
  });

  it("limites de proporção = feed orgânico do Instagram (1.91:1 … 3:4)", () => {
    expect(f).toMatch(/RATIO_MAX\s*=\s*1\.91/);
    expect(f).toMatch(/RATIO_MIN\s*=\s*3\s*\/\s*4/);
  });

  it("scroll programático respeita prefers-reduced-motion", () => {
    expect(f).toMatch(/prefers-reduced-motion/);
    expect(f).toMatch(
      /behavior:\s*resolveScrollBehavior\(prefereMovimentoReduzido\(\)\)/
    );
  });
});

describe("globals.css — controles do carrossel", () => {
  const css = read("styles/globals.css");

  it("esconde a barra de rolagem do scroller", () => {
    expect(css).toMatch(
      /\.feed-foto-scroller::-webkit-scrollbar\s*{\s*display:\s*none/
    );
  });

  it("setas escondidas por padrão, visíveis só em ponteiro fino com hover", () => {
    expect(css).toMatch(/\.feed-foto-seta\s*{\s*display:\s*none/);
    expect(css).toMatch(
      /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*{[\s\S]*?\.feed-foto-seta\s*{\s*display:\s*flex/
    );
  });
});
