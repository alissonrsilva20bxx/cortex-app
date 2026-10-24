import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");

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
