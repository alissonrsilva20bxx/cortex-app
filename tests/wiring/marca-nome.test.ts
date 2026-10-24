import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação: o nome em texto (tela de carregamento, login, PIN) usa
 * a letra da marca (DM Serif Display, ESPECIFICACAO da Arcelle) com "elle"
 * em rosa, e a fonte é carregada no layout pelo next/font, como as outras.
 */

const ROOT = join(__dirname, "..", "..");
const ler = (...p: string[]) =>
  readFileSync(join(ROOT, ...p), "utf-8").replace(/\r\n/g, "\n");

describe("nome da marca em texto", () => {
  it("o layout carrega a DM Serif Display (Regular) pelo next/font", () => {
    const src = ler("app", "layout.tsx");
    expect(src).toMatch(/DM_Serif_Display/);
    expect(src).toContain('variable: "--font-marca"');
    expect(src).toMatch(/weight: "400"/);
    expect(src).toContain("${marca.variable}");
  });

  it("o componente separa Arc e elle, com elle em rosa e -0,01em", () => {
    const tsx = ler("components", "MarcaNome.tsx");
    const css = ler("components", "MarcaNome.module.css");
    expect(tsx).toContain("Arc");
    expect(tsx).toContain("elle");
    expect(css).toContain("var(--font-marca)");
    expect(css).toContain("letter-spacing: -0.01em");
    expect(css).toMatch(/\.elle\s*\{[^}]*var\(--accent\)/);
  });

  it.each([
    ["components/LoadingScreen.tsx"],
    ["app/login/page.tsx"],
    ["components/pin/PinScreen.tsx"],
  ])("%s usa o componente em vez de texto solto", (arq) => {
    const src = ler(...arq.split("/"));
    expect(src).toContain("<MarcaNome");
    expect(src).not.toMatch(/>Arcelle</);
  });
});
