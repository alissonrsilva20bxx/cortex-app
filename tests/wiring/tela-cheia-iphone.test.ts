import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Tela cheia no iPhone (R10, prints do dono no iPhone 15 Pro Max): a
 * abertura parava antes do fim da tela (brilho cortado numa linha e faixa
 * preta embaixo) e o fundo do <html> era preto onde as camadas não chegam.
 * Teste de fiação: lê o fonte e exige altura em dvh (com vh de reserva
 * ANTES, para navegador sem dvh) nas camadas de tela cheia e a área segura
 * (env(safe-area-inset-*)) onde há botão no topo ou embaixo. O que só o
 * Safari do iPhone mostra (barra de baixo, app instalado) não cabe aqui.
 */

const ROOT = join(__dirname, "..", "..");
const ler = (...p: string[]) =>
  readFileSync(join(ROOT, ...p), "utf-8").replace(/\r\n/g, "\n");
// Troca o comentário de bloco pelas mesmas quebras de linha, para o número
// de linha do achado bater com o arquivo.
const semComentarios = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");

/** Corpo da 1ª regra `seletor { ... }` (sem blocos aninhados). */
function regra(css: string, seletor: string): string {
  const esc = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`Regra ${seletor} não encontrada`);
  return m[1];
}

/** Todas as regras `seletor { ... }`, juntas (ex.: body aparece em duas). */
function regras(css: string, seletor: string): string {
  const esc = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const achadas = [
    ...css.matchAll(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`, "g")),
  ].map((m) => m[1]);
  if (!achadas.length) throw new Error(`Regra ${seletor} não encontrada`);
  return achadas.join("\n");
}

/** 100vh de reserva e, depois, 100dvh na mesma propriedade. */
function vhDepoisDvh(corpo: string, prop: string) {
  const vh = corpo.indexOf(`${prop}: 100vh;`);
  const dvh = corpo.indexOf(`${prop}: 100dvh;`);
  expect(vh, `${prop}: 100vh; (reserva)`).toBeGreaterThan(-1);
  expect(dvh, `${prop}: 100dvh;`).toBeGreaterThan(vh);
}

const abertura = semComentarios(
  ler("components", "entry", "OpeningMotion.module.css")
);
const globais = semComentarios(ler("styles", "globals.css"));

describe("abertura (Rota das metas) cobre a tela inteira", () => {
  it(".motionScreen: fixa, inset 0 e altura mínima da tela visível (dvh, vh de reserva)", () => {
    const corpo = regra(abertura, ".motionScreen");
    expect(corpo).toMatch(/position: fixed;/);
    expect(corpo).toMatch(/inset: 0;/);
    vhDepoisDvh(corpo, "min-height");
  });

  it("a escala da cena (--u) continua com vh de reserva e dvh quando há suporte", () => {
    expect(regra(abertura, ".motionScreen")).toMatch(
      /--u: min\(calc\(100vw \/ 390\), calc\(100vh \/ 844\)\);/
    );
    expect(abertura).toMatch(
      /@supports \(height: 100dvh\) \{\s*\.motionScreen \{\s*--u: min\(calc\(100vw \/ 390\), calc\(100dvh \/ 844\)\);/
    );
  });

  it("o desenho não mudou: palco de 390×844 escalado por --u", () => {
    expect(regra(abertura, ".palco")).toMatch(/width: calc\(var\(--u\) \* 390\);/);
    expect(regra(abertura, ".palco")).toMatch(/height: calc\(var\(--u\) \* 844\);/);
  });

  it("o Pular fica abaixo da área segura de cima", () => {
    expect(regra(abertura, ".skip")).toMatch(
      /calc\(env\(safe-area-inset-top, 0px\) \+ 8px\)/
    );
  });
});

describe("fundo do <html> e do body", () => {
  it("<html> pinta a cor lisa do tema (--bg), não preto fixo", () => {
    const corpo = regra(globais, "html");
    expect(corpo).toMatch(/background-color: var\(--bg, #000\);/);
    expect(corpo).not.toMatch(/background: #000;/);
  });

  it("todo tema e o modo claro definem --bg (a cor que o <html> usa)", () => {
    for (const tema of [
      "grafite",
      "pink-neon",
      "purple",
      "crimson",
      "ocean",
      "gold",
      "emerald",
      "midnight",
    ]) {
      expect(regra(globais, `[data-theme="${tema}"]`)).toMatch(/--bg: #[0-9a-f]{6};/);
    }
    expect(regra(globais, '[data-mode="light"]')).toMatch(/--bg: #f5f5f7;/);
  });

  it("body: altura mínima da tela visível (dvh, vh de reserva)", () => {
    vhDepoisDvh(regras(globais, "body"), "min-height");
  });
});

describe("casca das telas e a barra de baixo (dock)", () => {
  const cascas = [
    ["app", "page.tsx"],
    ["app", "dev-preview", "app", "page.tsx"],
    ["app", "dev-preview", "rede", "page.tsx"],
  ];

  it(".min-h-tela: altura mínima da tela visível (dvh, vh de reserva)", () => {
    vhDepoisDvh(regra(globais, ".min-h-tela"), "min-height");
  });

  it.each(cascas)("%s/%s: casca em .min-h-tela, nada de h-screen/min-h-screen", (...p) => {
    const src = semComentarios(ler(...p));
    expect(src).toMatch(/className="relative flex flex-col min-h-tela"/);
    expect(src).not.toMatch(/\b(min-|max-)?h-screen\b/);
  });

  it.each(cascas)("%s/%s: o topo da casca soma a área segura de cima", (...p) => {
    expect(semComentarios(ler(...p))).toMatch(
      /paddingTop:\s*"calc\((var\(--space-shell-top\)|24px) \+ env\(safe-area-inset-top, 0px\)\)"/
    );
  });

  it("dock: a barra, o + e a pílula do teste somam a área segura de baixo", () => {
    const fundo =
      /bottom: `calc\(\$\{BOTTOM_NAV_OFFSET - navStyle\.translateY\}px \+ env\(safe-area-inset-bottom, 0px\)\)`/;
    expect(ler("components", "BottomNav.tsx")).toMatch(fundo);
    expect(ler("components", "FAB.tsx")).toMatch(fundo);
    expect(
      regra(
        semComentarios(ler("components", "onboarding", "linhaDoTempo.module.css")),
        ".trial"
      )
    ).toMatch(
      /bottom: calc\(\s*var\(--ob-pilula-bottom, 96px\) \+ env\(safe-area-inset-bottom, 0px\)\s*\);/
    );
  });

  it("nenhuma altura em vh sem dvh nas telas (app/, components/, styles/)", () => {
    // Fora da regra, de propósito: as folhas de Despesa e Receita (altura
    // ligada ao teclado, ver tests/wiring/teclado-sheet-176.test.ts) e o
    // voo das notas da carga (-130vh só tira a nota da tela).
    const permitidos = [
      "components/financeiro/DespesaForm.tsx",
      "components/financeiro/ReceitaForm.tsx",
      "components/LoadingScreen.module.css",
    ];
    const arquivos: string[] = [];
    const andar = (rel: string) => {
      for (const nome of readdirSync(join(ROOT, rel))) {
        const r = `${rel}/${nome}`;
        if (statSync(join(ROOT, r)).isDirectory()) andar(r);
        else if (/\.(tsx?|css)$/.test(nome) && !/\.test\./.test(nome)) arquivos.push(r);
      }
    };
    ["app", "components", "styles"].forEach(andar);
    const achados: string[] = [];
    for (const arq of arquivos) {
      if (permitidos.includes(arq)) continue;
      const linhas = semComentarios(ler(arq)).split("\n");
      linhas.forEach((linha, i) => {
        if (!/\b\d+vh\b|\b(min-|max-)?h-screen\b/.test(linha)) return;
        // vh de reserva vale só com a mesma propriedade em dvh logo abaixo.
        const prop = linha.match(/^\s*([\w-]+):/)?.[1];
        const seguinte = linhas.slice(i + 1, i + 3).join("\n");
        if (prop && new RegExp(`${prop}:[^;]*\\d+dvh`).test(seguinte)) return;
        // --u da abertura: a troca para dvh fica no @supports logo abaixo.
        if (/--u: min\(calc\(100vw \/ 390\), calc\(100vh \/ 844\)\);/.test(linha)) return;
        achados.push(`${arq}:${i + 1}: ${linha.trim()}`);
      });
    }
    expect(achados).toEqual([]);
  });
});
