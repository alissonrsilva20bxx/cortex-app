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
// Fim de linha normalizado (como em rede-feed-abas.test.ts): num checkout
// Windows com core.autocrlf os fontes chegam com CRLF, e o regex do
// PhotoStage (`\n}\n`) não casava.
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

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

  it("foto sangra a largura da tela e sem raio/sombra/borda própria", () => {
    // Sem margem negativa desde o pixel da Rede: o PostCard deixou de ter
    // padding lateral (a referência põe os 16px em cada bloco e sangra só a
    // foto), então a faixa já nasce com os 390px.
    expect(f).not.toMatch(/marginLeft:\s*-16/);
    expect(f).not.toMatch(/marginRight:\s*-16/);
    // a faixa da foto (helper `bleed`) não pode ter borda, raio nem sombra
    // própria (a única sombra do arquivo é a do círculo das setas).
    const bleedBody = f.match(/const bleed =[\s\S]*?\}\);/)?.[0] ?? "";
    expect(bleedBody).toBeTruthy();
    expect(bleedBody).not.toMatch(/borderRadius/);
    expect(bleedBody).not.toMatch(/border:/);
    expect(bleedBody).not.toMatch(/boxShadow/);
    expect(f.match(/boxShadow/g)).toHaveLength(1);
    expect(f).toMatch(/const setaCirculo[\s\S]*?boxShadow/);
  });

  it("o espaço da foto é --t-sub e o encaixe segue a regra dos formatos", () => {
    // Proposta "Três abas": o espaço da foto é `--t-sub` em todo post (a
    // alternância de tons era da referência antiga).
    expect(f).toMatch(/background:\s*tom,/);
    const card = read("components/rede/PostCard.tsx");
    expect(card).toMatch(/tom="var\(--t-sub\)"/);
    // "cortar" preenche o quadro centrado; sem isso, a foto cabe inteira.
    expect(f).toMatch(
      /encaixe === "cortar"\s*\?\s*\{ objectFit: "cover", objectPosition: "50% 50%" \}\s*:\s*\{ objectFit: "contain" \}/
    );
    // "inteira" tem o fundo desfocado da própria foto na sobra.
    expect(f).toMatch(
      /encaixe === "inteira" && thumbUrl && \([\s\S]{0,700}filter: "blur\(18px\) saturate\(1\.2\)"/
    );
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
    // slides ativos começam em 0..slideInicial (o slide lembrado do último
    // mount); num post sem memória, slideInicial === 0, só o 1º.
    expect(f).toMatch(
      /for \(let i = 0; i <= slideInicial; i\+\+\) s\.add\(i\)/
    );
  });

  it("carrossel: slide ativo é lembrado por post (sobrevive ao remount do PIN)", () => {
    expect(f).toMatch(
      /import\s*{\s*lembrarSlide,\s*slideLembrado\s*}\s*from\s*"@\/lib\/rede\/redeCache"/
    );
    expect(f).toMatch(/slideLembrado\(postId\)/);
    expect(f).toMatch(/lembrarSlide\(postId, i\)/);
    // reposiciona o scroller no slide lembrado antes do 1º paint
    expect(f).toMatch(/el\.scrollLeft = slideInicial \* \(el\.clientWidth/);
  });

  it('PhotoStage assina thumb/principal sob demanda quando o cache hidratado vem sem URL (não depende de <img src="">)', () => {
    // cache persistido não guarda URL assinada de 5min (req 5)
    expect(f).toMatch(
      /if \(!thumbUrl && !renovandoThumb\.current\) void renovarThumb\(\)/
    );
    expect(f).toMatch(
      /!url &&\s*!principalFalhou &&\s*!renovandoPrincipal\.current/
    );
    // a <img> da miniatura só monta com src de verdade
    expect(f).toMatch(/\{thumbUrl && \(/);
  });

  it("a foto do feed NÃO é interativa: não abre modal/fullscreen/página/visualizador", () => {
    // decisão 2026-09-10: o visualizador interno saiu do feed (PR #112).
    // ignora os comentários pra não casar com a nota que explica a remoção.
    const semComentarios = f
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "");
    expect(semComentarios).not.toMatch(/onAbrir/);
    expect(semComentarios).not.toMatch(/FotoViewer/);
    // nenhuma semântica de botão no palco da foto
    expect(semComentarios).not.toMatch(/role="button"/);
    const palco =
      semComentarios.match(/export function PhotoStage[\s\S]*?\n}\n/)?.[0] ??
      "";
    expect(palco).toBeTruthy();
    expect(palco).not.toMatch(/onKeyDown|tabIndex|onClick=\{\(\) => /);
    // o único foco/teclado é o do carrossel, e ele só navega (irPara)
    expect(semComentarios.match(/onKeyDown/g)).toHaveLength(1);
    expect(semComentarios).toMatch(
      /e\.key === "ArrowRight"\) \{\s*e\.preventDefault\(\);\s*irPara\(indice \+ 1\);/
    );
    expect(semComentarios).toMatch(
      /e\.key === "ArrowLeft"\) \{\s*e\.preventDefault\(\);\s*irPara\(indice - 1\);/
    );
    // sem detecção de "tap vs swipe" (existia só pra decidir se abria)
    expect(semComentarios).not.toMatch(/Math\.hypot/);
    expect(semComentarios).not.toMatch(/\bandou\b/);
  });

  it("carrossel continua com swipe horizontal nativo, bolinhas abaixo e contador 1/N", () => {
    expect(f).toMatch(/scrollSnapType:\s*"x mandatory"/);
    expect(f).toMatch(/data-bolinhas=""/);
    expect(f).toMatch(/\{indice \+ 1\}\/\{total\}/);
  });

  it("usa a memória de proporções das fotos legadas (localStorage)", () => {
    expect(f).toMatch(
      /import\s*{[\s\S]*?proporcaoLembrada[\s\S]*?}\s*from\s*"@\/lib\/rede\/fotoRatioMemoria"/
    );
    expect(f).toMatch(/proporcaoLembrada\(foto0\.thumbPath\)/);
    expect(f).toMatch(/lembrarProporcao\(foto0\.thumbPath/);
  });

  it("setas em qualquer aparelho (o dedo também desliza), alvo 44, somem nas pontas", () => {
    // Proposta "Três abas": deslizar com o dedo OU com os botões.
    expect(f).not.toMatch(/className="feed-foto-seta"/);
    expect(f).not.toMatch(/onMouseEnter|onMouseOver/);
    const setaBase = f.match(/const setaBase[\s\S]*?\n};/)?.[0] ?? "";
    expect(setaBase).toMatch(/width: 44,\s*height: 44,/);
    expect(f).toMatch(
      /\{indice > 0 && \(\s*<button[\s\S]{0,80}aria-label="Foto anterior"/
    );
    expect(f).toMatch(
      /\{indice < total - 1 && \(\s*<button[\s\S]{0,80}aria-label="Próxima foto"/
    );
    expect(f).toMatch(/onClick=\{\(\) => irPara\(indice - 1\)\}/);
    expect(f).toMatch(/onClick=\{\(\) => irPara\(indice \+ 1\)\}/);
  });

  it("as bolinhas ficam ABAIXO da foto (fora da bleed box), a ativa no acento", () => {
    const bolinhas =
      f.match(/data-bolinhas=""[\s\S]*?<\/div>\s*<\/>/)?.[0] ?? "";
    expect(bolinhas).toMatch(/marginTop: 10/);
    expect(bolinhas).toMatch(
      /i === indice \? "var\(--t-acc\)" : "var\(--t-ring\)"/
    );
    // depois do fechamento da bleed box (`</div>` antes das bolinhas)
    expect(f).toMatch(/<\/div>\s*\{\/\* bolinhas/);
  });

  it("NÃO anima a altura (foto legada assenta de uma vez)", () => {
    expect(f).not.toMatch(/transition:\s*"height/);
    expect(f).not.toMatch(/height\s+\d+ms/);
  });

  it("o quadro é um dos 4 formatos (lib/rede/formatoFoto), com altura em pixels inteiros", () => {
    expect(f).not.toMatch(/RATIO_MAX|RATIO_MIN|clampRatio/);
    expect(f).toMatch(/const formato = formatoMaisProximo\(ratio\);/);
    expect(f).toMatch(
      /altura: largura > 0 \? alturaDoQuadro\(largura, formato\) : 0,/
    );
    // carrossel: os slides seguem o quadro da 1ª foto
    expect(f).toMatch(/encaixeDoSlide\(ratioDe\(foto\), formato\)/);
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
