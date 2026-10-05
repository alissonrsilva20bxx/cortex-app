import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Jornada J01 — fundação visual das 5 telas novas. Mesmo padrão de teste
 * de fiação do resto do projeto (sem Testing Library, vitest em "node"):
 * lê o fonte como texto. Aqui a pergunta é se cada token novo de
 * styles/globals.css tem valor nos DOIS modos em CADA um dos 8 temas --
 * um token que só existe no escuro some no claro sem erro nenhum, e o
 * texto que dependia dele vira a cor herdada.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const css = read("styles/globals.css");

const THEMES = [
  "grafite",
  "pink-neon",
  "purple",
  "crimson",
  "ocean",
  "gold",
  "emerald",
  "midnight",
];

const NEW_COLOR_TOKENS = [
  "--accent-deep",
  "--accent-deep-2",
  "--accent-tint",
  "--card-solid",
  "--surface-sub",
  "--ring",
  "--hero-bg",
  "--hero-bg-2",
  "--hero-text-muted",
  "--hero-shadow",
  "--success-tint",
  "--success-line",
  "--danger-tint",
  "--info-tint",
  "--violet",
  "--violet-tint",
];

const SPACING_TOKENS = [
  "--space-shell-top",
  "--space-shell-x",
  "--space-header",
  "--space-section",
];

/** Blocos de nível superior (fora de @media): seletores -> declarações. */
function topLevelBlocks(source: string) {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: Array<{ selectors: string[]; decls: Map<string, string> }> = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < noComments.length; i++) {
    const c = noComments[i];
    if (c === "{") {
      if (depth === 0) {
        const selector = noComments.slice(start, i).trim();
        const end = noComments.indexOf("}", i);
        const body = noComments.slice(i + 1, end);
        if (!selector.startsWith("@") && !body.includes("{")) {
          const decls = new Map<string, string>();
          for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
            decls.set(m[1], m[2].trim());
          }
          blocks.push({
            selectors: selector.split(",").map((s) => s.trim()),
            decls,
          });
        }
      }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) start = i + 1;
    }
  }
  return blocks;
}

const blocks = topLevelBlocks(css);

/** Valor efetivo do token num tema/modo, pela mesma regra de cascata do
 * navegador: `:root` e um seletor de atributo têm a mesma especificidade,
 * então entre eles vence o bloco que vem depois; [data-mode][data-theme]
 * vence os dois. */
function resolve(token: string, theme: string, mode: "dark" | "light") {
  const applies = (sel: string) => {
    if (sel === ":root") return 1;
    if (sel === `[data-theme="${theme}"]`) return 1;
    if (mode === "light" && sel === `[data-mode="light"]`) return 1;
    if (
      mode === "light" &&
      sel === `[data-mode="light"][data-theme="${theme}"]`
    )
      return 2;
    return -1;
  };
  let best: { spec: number; value: string } | null = null;
  for (const b of blocks) {
    const value = b.decls.get(token);
    if (value === undefined) continue;
    const spec = Math.max(...b.selectors.map(applies));
    if (spec < 0) continue;
    if (!best || spec >= best.spec) best = { spec, value };
  }
  return best?.value;
}

describe("J01 — tokens novos existem e têm valor nos dois modos, nos 8 temas", () => {
  for (const token of NEW_COLOR_TOKENS) {
    it(`${token} definido em escuro e claro para cada tema`, () => {
      for (const theme of THEMES) {
        expect(resolve(token, theme, "dark"), `${theme}/escuro`).toBeTruthy();
        expect(resolve(token, theme, "light"), `${theme}/claro`).toBeTruthy();
      }
    });
  }

  it("o acento muda de tom no claro onde o mockup muda (--accent-tint de pink-neon)", () => {
    expect(resolve("--accent-tint", "pink-neon", "dark")).not.toBe(
      resolve("--accent-tint", "pink-neon", "light")
    );
  });

  it("os tokens de espaçamento da casca existem no :root compartilhado", () => {
    for (const token of SPACING_TOKENS) {
      expect(resolve(token, "grafite", "dark"), token).toMatch(/^\d+px$/);
      expect(resolve(token, "grafite", "light"), token).toMatch(/^\d+px$/);
    }
  });

  it("nenhum token existente foi redefinido pelo bloco da J01 (--accent continua só onde já estava)", () => {
    const j01 = css.slice(
      css.indexOf("Tokens das 5 telas novas (Jornada J01)")
    );
    const ate = j01.slice(0, j01.indexOf("── Base"));
    expect(ate).not.toMatch(/--accent:\s/);
    expect(ate).not.toMatch(/--text(-muted|-2)?:\s/);
    expect(ate).not.toMatch(/--(success|danger|info|warning):\s/);
  });
});

describe("J01 — casca usa os tokens de ritmo, não números soltos", () => {
  const tabPanel = read("components/TabPanel.tsx");
  const page = read("app/page.tsx");
  const lab = read("app/dev-preview/app/page.tsx");

  it("TabPanel marca o painel com .tab-panel e globals.css dá o espaço do cabeçalho por --space-header", () => {
    expect(tabPanel).toMatch(/className="tab-panel"/);
    expect(css).toMatch(
      /\.tab-panel > \* \+ \* \{\s*margin-top: var\(--space-header\);/
    );
  });

  it("o <main> do app e do laboratório começa em --space-shell-top", () => {
    expect(page).toMatch(
      /var\(--space-shell-top\) \+ env\(safe-area-inset-top/
    );
    expect(lab).toMatch(/var\(--space-shell-top\) \+ env\(safe-area-inset-top/);
    expect(page).not.toMatch(/calc\(24px \+ env\(safe-area-inset-top/);
    expect(lab).not.toMatch(/calc\(24px \+ env\(safe-area-inset-top/);
  });

  it("Início: espaço entre seções vem de --space-section, sem mt-6 dobrando o do cabeçalho", () => {
    for (const src of [page, lab]) {
      expect(src).toMatch(
        /grid grid-cols-\[minmax\(0,1fr\)\] gap-\[var\(--space-section\)\]/
      );
      expect(src).not.toMatch(/mt-6 grid grid-cols-\[minmax\(0,1fr\)\]/);
    }
  });
});

describe("J01 — nome acessível do + por aba, igual ao mockup", () => {
  const fab = read("components/FAB.tsx");
  const labels = fab.slice(fab.indexOf("const FAB_ARIA_LABELS"));

  it.each([
    ["home", "Novo"],
    ["jobs", "Novo atendimento"],
    ["financeiro", "Novo lançamento"],
    ["cofre", "Enviar arquivo"],
  ])("%s -> %s", (tab, label) => {
    expect(labels).toMatch(new RegExp(`${tab}: "${label}",`));
  });

  it("o botão usa o rótulo da aba quando fechado e 'Fechar' quando aberto", () => {
    expect(fab).toMatch(
      /aria-label=\{\s*open \? "Fechar" : \(FAB_ARIA_LABELS\[activeTab\] \?\? "Criar novo"\)\s*\}/
    );
  });

  it("nenhum dado ilustrativo do mockup entrou no código da casca", () => {
    for (const src of [fab, read("components/TabPanel.tsx"), css]) {
      expect(src).not.toMatch(/Renata|Carla Nunes|R\$ 430|Olá, Miguel/);
    }
  });
});
