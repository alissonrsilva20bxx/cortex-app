import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { formatMoeda, SIMBOLO_MOEDA } from "@/lib/finance";
import { CURRENCY } from "@/lib/jornada/textos";
import { PLANOS, formatarEuro } from "@/lib/planos";

/**
 * Moeda única: o app mostra tudo na moeda de lib/jornada/textos.ts (CURRENCY).
 * Os valores gravados são números e não mudam; só o texto de tela.
 */

const norm = (s: string) => s.replace(/[\s\u00a0\u202f]+/g, " ");

describe("formatMoeda", () => {
  it("usa a moeda do app (euro), com e sem centavos", () => {
    expect(CURRENCY).toBe("EUR");
    expect(norm(formatMoeda(1234))).toBe("€ 1.234");
    expect(norm(formatMoeda(1234.5, 2))).toBe("€ 1.234,50");
    expect(norm(formatMoeda(0))).toBe("€ 0");
  });

  it("o símbolo dos rótulos de campo é o da mesma moeda", () => {
    expect(SIMBOLO_MOEDA).toBe("€");
  });

  it("a vitrine da Rede mostra os planos reais (15, 25 e 30), no mesmo formato", () => {
    expect(PLANOS.map((p) => formatarEuro(p.preco))).toEqual([
      "€ 15",
      "€ 25",
      "€ 30",
    ]);
  });
});

describe("formatarEuro (vitrine da Rede e planos)", () => {
  it("vem do formatMoeda, sem escrever o símbolo da moeda à mão", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "lib/planos.ts"),
      "utf-8"
    );
    const corpo = src.slice(src.indexOf("export function formatarEuro"));
    expect(corpo.slice(0, corpo.indexOf("\n}\n"))).toContain("formatMoeda(");
    expect(corpo.slice(0, corpo.indexOf("\n}\n"))).not.toContain("€");
  });

  it("mantém o formato do desenho com centavos só quando precisa", () => {
    expect(formatarEuro(15)).toBe("€ 15");
    expect(formatarEuro(12.5)).toBe("€ 12,50");
  });
});

describe("nenhuma tela escreve reais solto", () => {
  const ROOT = join(__dirname, "..", "..");
  const IGNORADAS = [
    "components/ios-prototype",
    "app/dev-preview/ios",
    "node_modules",
  ];
  function fontes(dir: string, saida: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = relative(ROOT, p).split(sep).join("/");
      if (IGNORADAS.some((i) => rel === i || rel.startsWith(i + "/"))) continue;
      if (e.isDirectory()) fontes(p, saida);
      else if (/\.tsx?$/.test(e.name)) saida.push(rel);
    }
    return saida;
  }
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it('sem "R$", "BRL" nem formatBRL no código de app, components e lib', () => {
    const achados: string[] = [];
    for (const pasta of ["app", "components", "lib"]) {
      for (const rel of fontes(join(ROOT, pasta))) {
        const codigo = semComentarios(readFileSync(join(ROOT, rel), "utf-8"));
        if (/R\$|\bBRL\b|formatBRL/.test(codigo)) achados.push(rel);
      }
    }
    expect(achados).toEqual([]);
  });
});
