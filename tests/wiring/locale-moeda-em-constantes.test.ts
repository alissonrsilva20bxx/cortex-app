import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

/**
 * O idioma mora em lib/locale.ts (LOCALE) e as moedas em lib/moeda.ts
 * (Moeda, MOEDA_PADRAO). Trocar de país é mexer ali, não caçar literais. Teste de fiação, no padrão dos
 * outros em tests/wiring: lê o código com a API do TypeScript e reprova o
 * literal "pt-BR" ou "EUR" (string, template sem variável, ou texto de JSX)
 * em qualquer arquivo de app, components e lib, menos esses dois e testes.
 *
 * Os que já existiam estão em locale-moeda.baseline.json (dívida conhecida),
 * contados por arquivo + literal. Falha quando surge ocorrência NOVA. Ao
 * trocar um por LOCALE/CURRENCY, tire a linha (ou baixe a quantidade): o
 * teste também falha se a baseline ficou com sobra.
 */

const ROOT = join(__dirname, "..", "..");
const PASTAS = ["app", "components", "lib"];
const IGNORADAS = ["node_modules"];
const PERMITIDOS = ["lib/locale.ts", "lib/moeda.ts"];
const PROIBIDOS = ["pt-BR", "EUR"];

type Achado = { arquivo: string; literal: string; quantidade: number };
type Divida = Achado & { motivo: string };

function fontes(dir: string, saida: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = relative(ROOT, p).split(sep).join("/");
    if (IGNORADAS.some((i) => rel === i || rel.startsWith(i + "/"))) continue;
    if (e.isDirectory()) fontes(p, saida);
    else if (
      /\.tsx?$/.test(e.name) &&
      !/\.(test|spec)\.tsx?$/.test(e.name) &&
      !PERMITIDOS.includes(rel)
    ) {
      saida.push(rel);
    }
  }
  return saida;
}

function achados(): Achado[] {
  const contagem = new Map<string, Achado>();
  for (const pasta of PASTAS) {
    for (const rel of fontes(join(ROOT, pasta))) {
      const fonte = ts.createSourceFile(
        rel,
        readFileSync(join(ROOT, rel), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const somar = (literal: string) => {
        const chave = `${rel}\u0000${literal}`;
        const a = contagem.get(chave) ?? { arquivo: rel, literal, quantidade: 0 };
        a.quantidade += 1;
        contagem.set(chave, a);
      };
      const ver = (no: ts.Node) => {
        if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
          if (PROIBIDOS.includes(no.text)) somar(no.text);
        } else if (ts.isJsxText(no)) {
          for (const p of PROIBIDOS) {
            if (new RegExp(`(^|[^A-Za-z-])${p}($|[^A-Za-z-])`).test(no.text)) {
              somar(p);
            }
          }
        }
        ts.forEachChild(no, ver);
      };
      ver(fonte);
    }
  }
  return [...contagem.values()].sort((a, b) =>
    (a.arquivo + a.literal).localeCompare(b.arquivo + b.literal)
  );
}

const baseline: Divida[] = JSON.parse(
  readFileSync(join(__dirname, "locale-moeda.baseline.json"), "utf8")
);
const quantidadeNaBaseline = (a: { arquivo: string; literal: string }) =>
  baseline.find((b) => b.arquivo === a.arquivo && b.literal === a.literal)
    ?.quantidade ?? 0;

describe('literal "pt-BR"/"EUR" só em lib/locale.ts e lib/moeda.ts', () => {
  const hoje = achados();

  it("não surge ocorrência nova (use LOCALE de lib/locale.ts e a moeda de lib/moeda.ts)", () => {
    const novos = hoje.filter((a) => a.quantidade > quantidadeNaBaseline(a));
    expect(
      novos.map((a) => `${a.arquivo}: "${a.literal}" x${a.quantidade}`)
    ).toEqual([]);
  });

  it("a baseline não guarda dívida já paga (tire a linha ou baixe a quantidade)", () => {
    const sobra = baseline.filter(
      (b) =>
        b.quantidade >
        (hoje.find((a) => a.arquivo === b.arquivo && a.literal === b.literal)
          ?.quantidade ?? 0)
    );
    expect(sobra.map((b) => `${b.arquivo}: "${b.literal}"`)).toEqual([]);
  });
});
