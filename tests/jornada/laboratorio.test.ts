import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  criarTransporteJornadaLaboratorio,
  estadoJornadaContaNova,
  estadoJornadaExemplo,
} from "../../lib/mockJornada";
import { ehEstadoJornada } from "../../lib/jornada/estado";
import { textoMissao } from "../../lib/jornada/textos";

/**
 * Complemento da J11 (#161, #162) — os dados do laboratório
 * (`lib/mockJornada.ts`), que o `/dev-preview/app` usa enquanto a J10 não
 * existe. Precisam ser estados VÁLIDOS (o cliente recusa o resto) e as
 * missões precisam ser as da spec, não inventadas.
 */

const ROOT = join(__dirname, "..", "..");
const spec = readFileSync(
  join(ROOT, "docs/jornada/spec-sua-jornada.md"),
  "utf-8"
).replace(/\r\n/g, "\n");

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** As 3 missões de cada mês na tabela da §6, sem o ◆ de comunidade. */
function missoesDaSpec(mes: number): string[] {
  const linha = spec
    .split("\n")
    .find((l) => l.startsWith(`| ${MESES[mes - 1]} |`));
  expect(linha, MESES[mes - 1]).toBeTruthy();
  return linha!
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim())
    .slice(2, 5)
    .map((m) => m.replace(/^◆\s*/, ""));
}

describe("os estados do laboratório são estados válidos", () => {
  it("exemplo e conta nova passam na validação do cliente", () => {
    expect(ehEstadoJornada(estadoJornadaExemplo())).toBe(true);
    expect(ehEstadoJornada(estadoJornadaContaNova())).toBe(true);
  });

  it("no exemplo, o Glow dos pilares soma o total e o estágio fica entre os cortes", () => {
    const e = estadoJornadaExemplo();
    const soma = Object.values(e.glowPorPilar).reduce((a, b) => a + b, 0);
    expect(soma).toBe(e.glowTotal);
    expect(e.glowTotal).toBeGreaterThanOrEqual(e.glowInicioEstagio);
    expect(e.glowTotal).toBeLessThan(e.glowProximoEstagio);
  });

  it("no exemplo, a coleção tem um mês fechado antes do mês atual", () => {
    const e = estadoJornadaExemplo(new Date(2026, 9, 15));
    expect(e.colecao).toEqual([{ ano: 2026, mes: 8 }]);
    expect(e.hoje).toBe("2026-10-15");
  });

  it("conta nova: Glow zero, nenhum selo, coleção e marcos vazios, nada feito no mês", () => {
    const e = estadoJornadaContaNova(new Date(2026, 9, 15));
    expect(e.glowTotal).toBe(0);
    expect(Object.values(e.glowPorPilar)).toEqual([0, 0, 0, 0]);
    expect(e.estagio).toBe(0);
    expect(e.selos).toEqual({});
    expect(e.colecao).toEqual([]);
    expect(e.marcos).toEqual([]);
    expect(e.capitulo?.missoes.every((m) => m.progresso === 0)).toBe(true);
    expect(e.periodos.ultimoFechado).toEqual({});
  });

  it("a semana começa na segunda-feira (spec §2)", () => {
    // 15/10/2026 é uma quinta; a segunda é 12/10.
    const e = estadoJornadaExemplo(new Date(2026, 9, 15));
    expect(e.periodos.corrente.semana.inicio).toBe("2026-10-12");
    expect(e.periodos.ultimoFechado.semana?.inicio).toBe("2026-10-05");
    // Num domingo, a semana ainda é a que começou na segunda anterior.
    const domingo = estadoJornadaExemplo(new Date(2026, 9, 18));
    expect(domingo.periodos.corrente.semana.inicio).toBe("2026-10-12");
  });
});

describe("as missões do laboratório são as da spec §6", () => {
  it.each(MESES.map((m, i) => [m, i + 1] as const))(
    "%s: a trinca escrita pelo textos.ts bate com a spec",
    (_nome, mes) => {
      const e = estadoJornadaExemplo(new Date(2026, mes - 1, 15));
      expect(e.capitulo?.mes).toBe(mes);
      expect(
        e.capitulo?.missoes.map((m) => textoMissao(m.tipo, m.alvo))
      ).toEqual(missoesDaSpec(mes));
    }
  );
});

describe("o transporte de laboratório não é o motor", () => {
  it("registrar não muda Glow nem gera comemoração (isso é a J10)", async () => {
    const t = criarTransporteJornadaLaboratorio(estadoJornadaExemplo());
    const r = await t.registrar({
      acao: "despesa",
      chave: "k",
      fuso: "Europe/Lisbon",
      deslocamentoMin: 60,
    });
    expect(r.comemoracoes).toEqual([]);
    expect(r.estado.glowTotal).toBe(estadoJornadaExemplo().glowTotal);
  });

  it("preferências gravadas ficam pro próximo carregamento", async () => {
    const t = criarTransporteJornadaLaboratorio(estadoJornadaContaNova());
    await t.salvarPreferencias({ modoDiscreto: true });
    const e = await t.lerEstado("Europe/Lisbon", 60);
    expect(e.preferencias.modoDiscreto).toBe(true);
    expect(e.preferencias.somLigado).toBe(true);
  });
});
