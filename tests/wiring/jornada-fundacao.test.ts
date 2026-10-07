import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Jornada J01 — fundação visual das 5 telas novas. Mesmo padrão de teste
 * de fiação do resto do projeto (sem Testing Library, vitest em "node"):
 * lê o fonte como texto. Aqui a pergunta é se cada token novo de
 * styles/globals.css é declarado nos DOIS modos em CADA um dos 8 temas --
 * um token que só existe no escuro some no claro sem erro nenhum, e o
 * texto que dependia dele vira a cor herdada (ou a do grafite).
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

/**
 * Onde um token está DECLARADO -- não o valor que sobra depois da cascata.
 * Checar só o valor resolvido deixava passar o pior caso: o bloco escuro do
 * grafite é `:root, [data-theme="grafite"]`, então o `:root` dele responde
 * por qualquer tema e modo sem valor próprio. Apagar o claro inteiro ou um
 * tema inteiro continuava "tendo valor" (achado da revisão da PR #168).
 *
 * Por isso, aqui só contam:
 *  - escuro do tema X: um bloco cujos seletores incluem `[data-theme="X"]`,
 *    ou um bloco que é SÓ `:root` (token igual nos 8 temas, declarado uma
 *    vez de propósito);
 *  - claro do tema X: um bloco que é SÓ `[data-mode="light"]` (igual nos 8
 *    temas) ou `[data-mode="light"][data-theme="X"]`.
 * O `:root` grudado no grafite nunca conta pros outros temas.
 */
function declaredIn(token: string, accept: (selectors: string[]) => boolean) {
  return blocks
    .filter((b) => b.decls.has(token) && accept(b.selectors))
    .map((b) => b.decls.get(token)!);
}

const onlyRoot = (sels: string[]) => sels.length === 1 && sels[0] === ":root";

function darkDecl(token: string, theme: string) {
  return declaredIn(
    token,
    (sels) => onlyRoot(sels) || sels.includes(`[data-theme="${theme}"]`)
  );
}

function lightDecl(token: string, theme: string) {
  return declaredIn(
    token,
    (sels) =>
      sels.length === 1 &&
      (sels[0] === `[data-mode="light"]` ||
        sels[0] === `[data-mode="light"][data-theme="${theme}"]`)
  );
}

describe("J01 — cada token novo é declarado no escuro e no claro de cada um dos 8 temas", () => {
  for (const token of NEW_COLOR_TOKENS) {
    for (const theme of THEMES) {
      it(`${token} · ${theme} · escuro`, () => {
        expect(darkDecl(token, theme).length).toBeGreaterThan(0);
      });
      it(`${token} · ${theme} · claro`, () => {
        expect(lightDecl(token, theme).length).toBeGreaterThan(0);
      });
    }
  }

  it("o claro não é cópia do escuro: o acento suave muda de tom (--accent-tint de pink-neon)", () => {
    const dark = declaredIn("--accent-tint", (sels) =>
      sels.includes(`[data-theme="pink-neon"]`)
    );
    const light = declaredIn("--accent-tint", (sels) =>
      sels.includes(`[data-mode="light"][data-theme="pink-neon"]`)
    );
    expect(dark).toHaveLength(1);
    expect(light).toHaveLength(1);
    expect(dark[0]).not.toBe(light[0]);
  });

  it("os tokens de espaçamento da casca são declarados num :root compartilhado, em px", () => {
    for (const token of SPACING_TOKENS) {
      const decl = declaredIn(token, onlyRoot);
      expect(decl, token).toHaveLength(1);
      expect(decl[0], token).toMatch(/^\d+px$/);
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

  it("Início: espaço entre seções é o do mockup normativo (gap 12, 18 abaixo do cabeçalho), sem mt-6 dobrando", () => {
    // Pixel (mockup vence): o mockup do Início A usa gap 12px entre os
    // blocos e 18px entre o cabeçalho e o primeiro card.
    for (const src of [page, lab]) {
      expect(src).toMatch(
        /className="grid grid-cols-\[minmax\(0,1fr\)\]"\s+style=\{\{ gap: "12px", marginTop: "18px" \}\}/
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
