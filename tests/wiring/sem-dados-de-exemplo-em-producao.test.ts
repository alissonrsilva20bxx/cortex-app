import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

/**
 * Dados de exemplo só existem para o laboratório (retro das 3 semanas: o
 * status "concluído" só existia nos mocks, então tudo parecia funcionar).
 * Aqui os dados de exemplo são os arquivos lib/mock*.ts (mock, mockAppData,
 * mockFotosRede, mockJornada, mockRede, mockSupabase). Teste de fiação, no
 * padrão dos outros em tests/wiring: lê os imports com a API do TypeScript.
 *
 * Falha quando um arquivo de produção (tudo em app, components e lib, menos
 * app/dev-preview, os próprios lib/mock*.ts e testes) importa VALOR de um
 * deles. `import type` some na compilação e não conta. Os que já existiam
 * estão em sem-dados-de-exemplo.baseline.json: ao tirar um, apague a linha.
 */

const ROOT = join(__dirname, "..", "..");
const PASTAS = ["app", "components", "lib"];
const IGNORADAS = ["app/dev-preview", "node_modules"];

const DADOS_DE_EXEMPLO = readdirSync(join(ROOT, "lib"))
  .filter((n) => /^mock[A-Za-z]*\.ts$/.test(n))
  .map((n) => n.replace(/\.ts$/, ""));

type Uso = { arquivo: string; modulo: string; nomes: string[] };

function fontes(dir: string, saida: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = relative(ROOT, p).split(sep).join("/");
    if (IGNORADAS.some((i) => rel === i || rel.startsWith(i + "/"))) continue;
    if (e.isDirectory()) fontes(p, saida);
    else if (
      /\.tsx?$/.test(e.name) &&
      !/\.(test|spec)\.tsx?$/.test(e.name) &&
      !(rel.startsWith("lib/") && DADOS_DE_EXEMPLO.includes(e.name.replace(/\.tsx?$/, "")) && !rel.slice(4).includes("/"))
    ) {
      saida.push(rel);
    }
  }
  return saida;
}

/** "@/lib/mockRede", "../mockRede" ou "./mockRede" -> "mockRede"; senão null. */
function moduloDeExemplo(especificador: string): string | null {
  const m = /^(?:@\/lib\/|\.{1,2}\/(?:\.\.\/)*(?:lib\/)?)(mock[A-Za-z]*)$/.exec(
    especificador
  );
  return m && DADOS_DE_EXEMPLO.includes(m[1]) ? m[1] : null;
}

function usosDeExemplo(rel: string, codigo: string): Uso[] {
  const fonte = ts.createSourceFile(
    rel,
    codigo,
    ts.ScriptTarget.Latest,
    true,
    rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const usos: Uso[] = [];
  const achou = (esp: string, nomes: string[]) => {
    const modulo = moduloDeExemplo(esp);
    if (modulo) usos.push({ arquivo: rel, modulo, nomes: nomes.sort() });
  };
  const ver = (no: ts.Node) => {
    if (ts.isImportDeclaration(no) && ts.isStringLiteral(no.moduleSpecifier)) {
      const c = no.importClause;
      if (!c?.isTypeOnly) {
        const nomes: string[] = [];
        if (!c) nomes.push("(efeito colateral)");
        if (c?.name) nomes.push("default");
        const nb = c?.namedBindings;
        if (nb && ts.isNamespaceImport(nb)) nomes.push("*");
        if (nb && ts.isNamedImports(nb)) {
          for (const el of nb.elements) {
            if (!el.isTypeOnly) nomes.push((el.propertyName ?? el.name).text);
          }
        }
        if (nomes.length) achou(no.moduleSpecifier.text, nomes);
      }
    } else if (
      ts.isExportDeclaration(no) &&
      no.moduleSpecifier &&
      ts.isStringLiteral(no.moduleSpecifier) &&
      !no.isTypeOnly
    ) {
      achou(no.moduleSpecifier.text, ["(reexporta)"]);
    } else if (
      ts.isCallExpression(no) &&
      (no.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(no.expression) && no.expression.text === "require")) &&
      no.arguments[0] &&
      ts.isStringLiteral(no.arguments[0])
    ) {
      achou(no.arguments[0].text, ["(import dinâmico)"]);
    }
    ts.forEachChild(no, ver);
  };
  ver(fonte);
  return usos;
}

const chave = (u: Uso) => `${u.arquivo} -> ${u.modulo}: ${u.nomes.join(", ")}`;

describe("sem dados de exemplo em produção", () => {
  const baseline: Uso[] = JSON.parse(
    readFileSync(
      join(__dirname, "sem-dados-de-exemplo.baseline.json"),
      "utf-8"
    )
  );
  const achados = PASTAS.flatMap((p) => fontes(join(ROOT, p))).flatMap((rel) =>
    usosDeExemplo(rel, readFileSync(join(ROOT, rel), "utf-8"))
  );

  it("descobre os arquivos de dados de exemplo", () => {
    expect(DADOS_DE_EXEMPLO).toEqual(
      expect.arrayContaining(["mock", "mockRede", "mockJornada", "mockAppData"])
    );
  });

  it("o detector acha import de valor e ignora import de tipo", () => {
    const codigo = `
      import { findUser, type Privacidade } from "@/lib/mockRede";
      import type { Cliente } from "@/lib/mockRede";
      import { type Job } from "../mock";
      import { mockJobs } from "../mock";
      import ok from "./mockImagem";
    `;
    expect(
      usosDeExemplo("components/x.ts", codigo).map(chave)
    ).toEqual([
      "components/x.ts -> mockRede: findUser",
      "components/x.ts -> mock: mockJobs",
    ]);
  });

  it("nenhum arquivo de produção importa dado de exemplo (fora da baseline)", () => {
    const base = new Set(baseline.map(chave));
    const novos = achados.filter((a) => !base.has(chave(a)));
    expect(
      novos.map(chave),
      "Dado de exemplo importado em produção. Use dado real (Supabase) ou mova para app/dev-preview."
    ).toEqual([]);
  });

  it("a baseline não guarda import que já foi removido", () => {
    const vivos = new Set(achados.map(chave));
    expect(
      baseline.map(chave).filter((b) => !vivos.has(b)),
      "Tire estas linhas de sem-dados-de-exemplo.baseline.json"
    ).toEqual([]);
  });
});
