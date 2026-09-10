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
 *  - swipe não abre o visualizador (limiar de toque);
 *  - `prefers-reduced-motion` respeitado no scroll programático.
 *
 * O projeto não tem RTL/JSX no vitest — ler o arquivo como texto pega o
 * mesmo tipo de regressão (import trocado, `object-cover` de volta,
 * transição de altura reintroduzida, seta vazando no touch).
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

  it("a principal carrega sob demanda (loading=lazy), não antecipada", () => {
    expect(f).toMatch(/loading="lazy"/);
  });

  it("setas só via classe .feed-foto-seta (escondidas no touch por CSS)", () => {
    expect(f).toMatch(/className="feed-foto-seta"/);
    // nada de setas sempre visíveis / dependentes de estado de hover em JS
    expect(f).not.toMatch(/onMouseEnter|onMouseOver/);
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

  it("swipe não abre o visualizador (limiar de toque em px)", () => {
    expect(f).toMatch(/Math\.hypot\([\s\S]*?\)\s*<=\s*10/);
  });

  it("scroll programático respeita prefers-reduced-motion", () => {
    expect(f).toMatch(/prefers-reduced-motion/);
    expect(f).toMatch(
      /behavior:\s*prefereMovimentoReduzido\(\)\s*\?\s*"auto"\s*:\s*"smooth"/
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
