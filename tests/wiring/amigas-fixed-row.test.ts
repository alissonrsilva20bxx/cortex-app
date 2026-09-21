import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressão — linha fixa de Amigas/Solicitações/Descobrir no Feed da Rede
 * (redesign iOS quase nativo, wayfinder #122, achado T20/#127, corrigido em
 * `75fc01d`). Mesmo padrão de inspeção de código-fonte já usado no projeto
 * (sem DOM).
 *
 * Bug original: os blocos contextuais de "solicitações"/"descobrir" só
 * entravam no feed intercalados entre posts (`queue.shift()` dentro do
 * `.forEach` sobre `visiblePosts`, nos índices [1, 4, 6]) — com feed vazio
 * ou curto (o caso mais comum de quem acabou de entrar na Rede, que é
 * justamente quem mais precisa achar gente), esses blocos nunca apareciam
 * e a tela de Amigas ficava inatingível. Violava "Preservar: Minhas
 * amigas, Solicitações e Descobrir" do contrato de paridade.
 *
 * A correção não mexeu na lógica de intercalação (que continua existindo
 * pros blocos "solicitações pendentes"/"mensagens"/"wishlist"/"descobrir
 * pessoas" contextuais) — ela SOMA uma linha fixa, sempre visível, logo
 * abaixo dos tabs Para você/Amigas, independente de posts/loading/erro.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const feedScreenSrc = read("components/rede/FeedScreen.tsx");
const redeTabSrc = read("components/rede/RedeTab.tsx");
const amigasScreenSrc = read("components/rede/AmigasScreen.tsx");

describe("FeedScreen — linha fixa de Amigas é incondicional (fora do items.map, fora do vazio/carregando/erro)", () => {
  it('existe um <ContextualBlock title="Amigas" .../> fixo, ligado a onOpenAmigas', () => {
    expect(feedScreenSrc).toMatch(
      /<ContextualBlock\s+icon=\{<Users2[\s\S]{0,80}\/>\}\s+title="Amigas"\s+subtitle="Solicitações e descobrir pessoas"\s+onClick=\{onOpenAmigas\}\s*\/>/
    );
  });

  it("a linha fixa aparece ANTES (em ordem de fonte) do bloco condicional de loading/erro/vazio/posts — não está aninhada dentro dele", () => {
    const fixedIdx = feedScreenSrc.indexOf('title="Amigas"');
    const conditionalIdx = feedScreenSrc.indexOf(
      "loading && posts.length === 0 ?"
    );
    expect(fixedIdx).toBeGreaterThan(-1);
    expect(conditionalIdx).toBeGreaterThan(-1);
    expect(fixedIdx).toBeLessThan(conditionalIdx);
  });

  it("a linha fixa aparece ANTES do array `items` ser consumido (items.map) — não depende de haver posts/blocos intercalados", () => {
    const fixedIdx = feedScreenSrc.indexOf('title="Amigas"');
    const itemsMapIdx = feedScreenSrc.indexOf("items.map((item) =>");
    expect(itemsMapIdx).toBeGreaterThan(-1);
    expect(fixedIdx).toBeLessThan(itemsMapIdx);
  });

  it("a linha fixa não é envolvida por nenhuma guarda de tamanho (items/posts/visiblePosts/discover) — a tag de abertura <ContextualBlock> vem logo depois da SegmentedControl fechar, sem condicional entre as duas", () => {
    const openTagIdx = feedScreenSrc.indexOf(
      "<ContextualBlock\n        icon={<Users2"
    );
    const segmentedControlCloseIdx = feedScreenSrc.lastIndexOf(
      "/>",
      openTagIdx
    );
    expect(openTagIdx).toBeGreaterThan(-1);
    const between = feedScreenSrc.slice(
      segmentedControlCloseIdx + 2,
      openTagIdx
    );
    // Só pode haver espaço em branco e comentários JSX ({/* ... */}) entre o
    // fechamento da SegmentedControl e a abertura do bloco fixo. Removendo
    // os comentários, não pode sobrar nenhum `{` de condicional/ternário.
    const withoutComments = between.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(withoutComments.trim()).toBe("");
  });

  it("a lógica de intercalação original (queue/blocks por posts[1,4,6]) continua existindo — a correção somou, não substituiu", () => {
    expect(feedScreenSrc).toMatch(
      /if \(\[1, 4, 6\]\.includes\(i\) && queue\.length\)/
    );
  });
});

describe("Rede — onOpenAmigas navega pra AmigasScreen de verdade (não placeholder)", () => {
  it('RedeTab liga onOpenAmigas a um push real de tela ({ type: "amigas" })', () => {
    expect(redeTabSrc).toMatch(
      /onOpenAmigas=\{\(\) => push\(\{ type: "amigas" \}\)\}/
    );
  });

  it('RedeTab renderiza <AmigasScreen> quando screen.type === "amigas"', () => {
    expect(redeTabSrc).toMatch(
      /screen\.type === "amigas"[\s\S]{0,40}<AmigasScreen/
    );
  });
});

describe("AmigasScreen — Solicitações e Descobrir permanecem alcançáveis independente de contagem", () => {
  it("as 3 sub-abas (Minhas amigas/Solicitações/Descobrir) são sempre renderizadas na SegmentedControl, não condicionadas a requests.length ou discover.length", () => {
    expect(amigasScreenSrc).toMatch(
      /options=\{\[\s*\r?\n\s*\{ id: "amigas", label: "Minhas amigas" \},\s*\r?\n\s*\{\s*\r?\n\s*id: "solicitacoes",/
    );
    expect(amigasScreenSrc).toMatch(
      /\{ id: "descobrir", label: "Descobrir" \}/
    );
  });

  it("trocar de sub-aba é um simples setTab (SegmentedControl.onChange={setTab}) — sem guard de contagem que possa travar o acesso", () => {
    expect(amigasScreenSrc).toMatch(/onChange=\{setTab\}/);
  });

  it('o label de "Solicitações" só ganha um contador quando requests.length > 0, mas a aba em si (id "solicitacoes") não depende dessa condição pra existir', () => {
    expect(amigasScreenSrc).toMatch(
      /label: `Solicitações\$\{requests\.length \? ` \(\$\{requests\.length\}\)` : ""\}`,/
    );
  });
});
