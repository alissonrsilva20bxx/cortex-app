import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { formatMoeda, simboloMoeda } from "@/lib/moeda";
import { PLANOS, cheioDoPlano, precoDoPlano } from "@/lib/planos";

/**
 * Moeda única, duas moedas: só o formatador central (lib/moeda.ts) escreve
 * símbolo ou código de moeda. O resto do app recebe a moeda como valor e
 * pede o texto pronto. Os valores gravados são números e não mudam; só o
 * texto de tela.
 */

const norm = (s: string) => s.replace(/[\s\u00a0\u202f]+/g, " ");

describe("formatMoeda", () => {
  it("euro: a moeda padrão, com e sem centavos", () => {
    expect(norm(formatMoeda(1234, "EUR"))).toBe("€ 1.234");
    expect(norm(formatMoeda(1234.5, "EUR", 2))).toBe("€ 1.234,50");
    expect(norm(formatMoeda(0, "EUR"))).toBe("€ 0");
  });

  it("dólar: o mesmo número com US$", () => {
    expect(norm(formatMoeda(1234, "USD"))).toBe("US$ 1.234");
    expect(norm(formatMoeda(1234.5, "USD", 2))).toBe("US$ 1.234,50");
  });

  it("o símbolo dos rótulos de campo é o da mesma moeda", () => {
    expect(simboloMoeda("EUR")).toBe("€");
    expect(simboloMoeda("USD")).toBe("US$");
  });

  it("a vitrine da Rede mostra os planos reais (15, 25 e 30), nas duas moedas", () => {
    expect(
      PLANOS.map((p) => norm(formatMoeda(precoDoPlano(p, "EUR"), "EUR", "auto")))
    ).toEqual(["€ 15", "€ 25", "€ 30"]);
    expect(
      PLANOS.map((p) => norm(formatMoeda(precoDoPlano(p, "USD"), "USD", "auto")))
    ).toEqual(["US$ 15", "US$ 25", "US$ 30"]);
    expect(PLANOS.map((p) => cheioDoPlano(p, "EUR"))).toEqual([null, 30, 45]);
  });
});

describe("só o formatador central escreve símbolo ou código de moeda", () => {
  const ROOT = join(__dirname, "..", "..");
  const CENTRAL = "lib/moeda.ts";
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
      else if (/\.tsx?$/.test(e.name) && rel !== CENTRAL) saida.push(rel);
    }
    return saida;
  }
  const todas = ["app", "components", "lib"].flatMap((p) =>
    fontes(join(ROOT, p))
  );

  /** Literais de texto do código (strings, templates, texto de JSX), sem
   * comentários e independente do fim de linha do arquivo. */
  function literais(rel: string): string[] {
    const fonte = ts.createSourceFile(
      rel,
      readFileSync(join(ROOT, rel), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const achados: string[] = [];
    const ver = (no: ts.Node) => {
      if (
        ts.isStringLiteral(no) ||
        ts.isNoSubstitutionTemplateLiteral(no) ||
        ts.isTemplateHead(no) ||
        ts.isTemplateMiddle(no) ||
        ts.isTemplateTail(no) ||
        ts.isJsxText(no)
      )
        achados.push(no.text);
      ts.forEachChild(no, ver);
    };
    ver(fonte);
    return achados;
  }

  const SIMBOLO_OU_CODIGO = /€|R\$|US\$|\b(BRL|EUR|USD)\b/i;

  it("nenhum literal de texto traz € / R$ / US$ nem o código BRL, EUR ou USD", () => {
    const achados = todas.filter((rel) =>
      literais(rel).some((t) => SIMBOLO_OU_CODIGO.test(t))
    );
    expect(achados).toEqual([]);
  });

  it('nenhum arquivo monta moeda com Intl ("currency") nem tem outro formatador de dinheiro', () => {
    const achados = todas.filter((rel) => {
      const codigo = readFileSync(join(ROOT, rel), "utf8");
      return (
        literais(rel).includes("currency") ||
        /\b(formatBRL|formatEUR|formatarEuro|SIMBOLO_MOEDA|CURRENCY)\b/.test(
          codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
        )
      );
    });
    expect(achados).toEqual([]);
  });

  it("o formatador central é o que escreve: moeda.ts é o único com os símbolos", () => {
    const src = readFileSync(join(ROOT, CENTRAL), "utf8");
    expect(src).toContain("Intl.NumberFormat");
    expect(src).toContain('style: "currency"');
  });
});
