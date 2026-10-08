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
// Normaliza CRLF -> LF: os testes abaixo usam `\n` literal em indexOf/lastIndexOf
// pra achar posições exatas de trecho de fonte, e isso não pode depender de
// como o arquivo foi salvo no disco (core.autocrlf, checkout no Windows etc.).
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8").replace(/\r\n/g, "\n");
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

  it("a linha fixa é INCONDICIONAL: nenhuma guarda de tamanho (items/posts/visiblePosts/discover) a envolve", () => {
    // O que o achado T20/#127 protege é o acesso GARANTIDO a Amigas /
    // Solicitações / Descobrir, inclusive com o feed vazio ou curto -- ou
    // seja: o bloco não pode estar atrás de nenhuma condicional.
    //
    // O LUGAR dele mudou por ordem do operador de 07/10/2026: o que a
    // referência não desenha fica abaixo da dobra dela, em vez de empurrar
    // o feed. Esconder não era permitido; mover, sim. Por isso este teste
    // deixou de fixar a posição e passou a fixar o que importa.
    const idx = feedScreenSrc.search(/<ContextualBlock\n\s*icon=\{<Users2/);
    expect(idx).toBeGreaterThan(-1);

    // Profundidade de chaves a partir do início do JSX da tela: se o bloco
    // estiver dentro de qualquer `{...}` (toda condicional em JSX é uma),
    // a profundidade é maior que zero.
    const jsxIdx = feedScreenSrc.indexOf("<PullToRefresh");
    const antes = feedScreenSrc
      .slice(jsxIdx, idx)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // comentários JSX
      .replace(/"(?:[^"\\]|\\.)*"/g, '""') // strings
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");
    const profundidade =
      (antes.match(/\{/g) ?? []).length - (antes.match(/\}/g) ?? []).length;
    expect(profundidade).toBe(0);

    // E continua fora do `items.map`, que é o caminho dos blocos
    // intercalados (aqueles sim dependem de haver posts).
    const mapIdx = feedScreenSrc.indexOf("items.map");
    const fimDoMap = feedScreenSrc.indexOf("})}", mapIdx);
    expect(idx > fimDoMap || idx < mapIdx).toBe(true);
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
      /onOpenAmigas=\{\(\) => \{\s*revalidarSocial\(\);\s*push\(\{ type: "amigas" \}\);\s*\}\}/
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
