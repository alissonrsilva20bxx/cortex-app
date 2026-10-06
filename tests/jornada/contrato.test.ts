import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ACOES,
  MARCOS_DINHEIRO,
  PILARES,
  SELOS,
} from "../../lib/jornada/estado";
import { NOME_PILAR, SELO } from "../../lib/jornada/textos";

/**
 * J11 (#161) — o contrato do cliente com a spec e com o banco, travado.
 *
 * 1. **O cliente não decide Glow** (spec §8: "o servidor decide tudo"). Varre
 *    TODOS os arquivos de `lib/jornada/` e `components/jornada/` — inclusive
 *    os que as próximas telas criarem — atrás de valor de Glow, limite ou
 *    corte de estágio.
 * 2. **As listas do cliente batem com a spec e com a migration 0034 (J09)**:
 *    ações (§3), selos (§5), pilares (§1.3) e marcos de dinheiro (§7). Se
 *    alguém mudar um lado sem o outro, o teste quebra.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

function arquivos(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  const out: string[] = [];
  for (const nome of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...arquivos(rel));
    else if (/\.(ts|tsx)$/.test(rel)) out.push(rel);
  }
  return out;
}

const DA_JORNADA = [
  ...arquivos("lib/jornada"),
  ...arquivos("components/jornada"),
];

function soCodigo(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const spec = read("docs/jornada/spec-sua-jornada.md");

/** As linhas de tabela de uma seção da spec (`## N.` até a próxima `## `). */
function linhasDaSecao(numero: number): string[][] {
  const inicio = spec.indexOf(`## ${numero}.`);
  expect(inicio, `seção ${numero} da spec`).toBeGreaterThan(-1);
  const fim = spec.indexOf("\n## ", inicio + 1);
  return spec
    .slice(inicio, fim === -1 ? undefined : fim)
    .split("\n")
    .filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l))
    .map((l) =>
      l
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim())
    );
}

// ---------------------------------------------------------------------------
// 1. O cliente não decide Glow
// ---------------------------------------------------------------------------

describe("nenhum valor de Glow, limite ou corte de estágio no cliente", () => {
  it("a varredura cobre todos os arquivos da Jornada", () => {
    expect(DA_JORNADA).toEqual(
      expect.arrayContaining([
        "lib/jornada/estado.ts",
        "lib/jornada/cliente.ts",
        "lib/jornada/cache.ts",
        "lib/jornada/textos.ts",
        "components/jornada/useJornada.ts",
      ])
    );
  });

  // `textos.ts` escreve números por extenso (romanos, plural): fica fora só
  // desta regra, não das outras duas abaixo.
  const SEM_NUMEROS = DA_JORNADA.filter((f) => f !== "lib/jornada/textos.ts");

  it.each(SEM_NUMEROS)("%s não tem número maior que 1 no código", (arquivo) => {
    let codigo = soCodigo(read(arquivo));
    // Exceções: os marcos de dinheiro (euros, chaves, não Glow), conferidos
    // contra a spec §7 abaixo, e os 3 níveis de selo.
    codigo = codigo
      .replace(/export const MARCOS_DINHEIRO = \[[^\]]*\] as const;/, "")
      // Os 3 níveis de selo (I, II, III) da spec §5: chave de tipo, não Glow.
      .replace(/export type NivelSelo = 1 \| 2 \| 3;/, "");
    expect(codigo.match(/(?<![\w.])(?:[2-9]|\d{2,})(?![\w.])/g) ?? []).toEqual(
      []
    );
  });

  it.each(DA_JORNADA)("%s não tem tabela de ação → número", (arquivo) => {
    const codigo = soCodigo(read(arquivo));
    const chaves = [...ACOES, ...SELOS, ...PILARES].join("|");
    // `despesa: 5`, `"receita": 5`, `planejadora: [1, 10, 50]`…
    expect(codigo).not.toMatch(
      new RegExp(`["']?\\b(${chaves})\\b["']?\\s*:\\s*[\\[\\d]`)
    );
  });

  it.each(DA_JORNADA)(
    "%s não tem nome de tabela de pontos, limite ou corte",
    (arquivo) => {
      const codigo = soCodigo(read(arquivo));
      expect(codigo).not.toMatch(
        /\b(GLOW_POR\w*|PONTOS|PTS|LIMITES?|TETOS?|CORTES?|TIERS?|CAPS?)\b\s*[:=]/i
      );
    }
  );
});

// ---------------------------------------------------------------------------
// 2. As listas batem com a spec e com a migration
// ---------------------------------------------------------------------------

describe("marcos de dinheiro = spec §7", () => {
  it("os mesmos valores, na mesma ordem", () => {
    const daSpec = linhasDaSecao(7)
      .map((c) => c[0])
      .filter((c) => c.startsWith("€"))
      .map((c) => Number(c.replace(/[^\d]/g, "")));
    expect(daSpec).toEqual([500, 1000, 2500, 5000]);
    expect([...MARCOS_DINHEIRO]).toEqual(daSpec);
  });
});

describe("selos = spec §5", () => {
  it("os 11 selos, na ordem e com os nomes da spec", () => {
    const daSpec = linhasDaSecao(5)
      .slice(1) // cabeçalho
      .map((c) => c[0]);
    expect(daSpec).toHaveLength(11);
    expect(SELOS.map((s) => SELO[s].nome)).toEqual(daSpec);
  });
});

describe("pilares = spec §1.3", () => {
  it("os 4 pilares da spec", () => {
    expect(spec).toContain(
      "**4 pilares:** Organizar, Prosperar, Proteger, Conectar."
    );
    expect(PILARES.map((p) => NOME_PILAR[p])).toEqual([
      "Organizar",
      "Prosperar",
      "Proteger",
      "Conectar",
    ]);
  });
});

describe("ações = spec §3 = migration 0034 (J09)", () => {
  const migration = read("supabase/migrations/0034_jornada_contadores.sql");

  it("o mesmo número de ações da tabela da §3 (9)", () => {
    const daSpec = linhasDaSecao(3).filter(
      (c) => c.length === 4 && c[0] !== "Ação"
    );
    expect(daSpec).toHaveLength(9);
    expect(ACOES).toHaveLength(daSpec.length);
  });

  it("cada ação do cliente é uma chave de ação da J09", () => {
    const bloco = migration.match(
      /Chaves de ação da §3[^\n]*\n((?:--[^\n]*\n)+)/
    );
    expect(bloco).not.toBeNull();
    const daMigration = [...bloco![1].matchAll(/'([a-z_]+)'/g)].map(
      (m) => m[1]
    );
    expect([...ACOES].sort()).toEqual([...daMigration].sort());
  });
});
