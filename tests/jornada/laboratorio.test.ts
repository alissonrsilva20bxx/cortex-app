import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  criarTransporteJornadaLaboratorio,
  estadoJornadaAno,
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
/** As missões do mês pela spec §6 (0036): a trinca (mês - 1) % 3 + 1. */
function missoesDaSpec(mes: number): string[] {
  const trinca = ((mes - 1) % 3) + 1;
  const linha = spec.split("\n").find((l) => l.startsWith(`| ${trinca} |`));
  expect(linha, `trinca ${trinca} (${MESES[mes - 1]})`).toBeTruthy();
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

  it('no exemplo (foto "Agora"), o estágio fica entre os cortes e cada pilar dá a % do protótipo', () => {
    const e = estadoJornadaExemplo();
    expect(e.glowTotal).toBeGreaterThanOrEqual(e.glowInicioEstagio);
    expect(e.glowTotal).toBeLessThan(e.glowProximoEstagio);
    // A regra do servidor (0036, private.jornada_pilar_pct): Glow / 160
    // (Conectar: / 125), até 100%. A foto do protótipo não fecha a soma dos
    // pilares com o total, e o servidor também não fecha (capítulo).
    const pct = (glow: number, div: number) =>
      Math.min(100, Math.round((glow * 100) / div));
    expect(e.pilares).toEqual({
      organizar: pct(e.glowPorPilar.organizar, 160),
      prosperar: pct(e.glowPorPilar.prosperar, 160),
      proteger: pct(e.glowPorPilar.proteger, 160),
      conectar: pct(e.glowPorPilar.conectar, 125),
    });
  });

  it('no exemplo (foto "Agora" do protótipo), a coleção ainda está vazia', () => {
    const e = estadoJornadaExemplo(new Date(2026, 9, 15));
    expect(e.colecao).toEqual([]);
    expect(e.hoje).toBe("2026-10-15");
  });

  it('no ano (foto "Mês 14" do protótipo), 11 enfeites e 3 meses em branco', () => {
    const e = estadoJornadaAno(new Date(2027, 11, 3));
    expect(ehEstadoJornada(e)).toBe(true);
    expect(e.colecao).toHaveLength(11);
    const chaves = e.colecao.map((m) => `${m.ano}-${m.mes}`);
    for (const branco of ["2026-12", "2027-3", "2027-8"])
      expect(chaves).not.toContain(branco);
    expect(e.glowTotal).toBeGreaterThanOrEqual(e.glowInicioEstagio);
    expect(e.glowTotal).toBeLessThan(e.glowProximoEstagio);
  });

  it("os selos: o próximo corte sai dos cortes do servidor (0035 jornada_selos_def)", () => {
    const e = estadoJornadaExemplo();
    expect(e.selosProgresso?.planejadora).toEqual({ contador: 3, proximo: 10 });
    expect(e.selosProgresso?.mao_amiga).toEqual({ contador: 14, proximo: 25 });
    expect(e.selosProgresso?.guardia).toEqual({ contador: 4, proximo: 5 });
    expect(e.selosProgresso?.primeiros_passos).toEqual({
      contador: 1,
      proximo: null,
    });
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/0035_jornada_rpcs.sql"),
      "utf-8"
    );
    expect(sql).toContain(
      "('planejadora',      'organizar', 'dias_planejar',      1, 10, 50)"
    );
    expect(sql).toContain(
      "('mao_amiga',        'conectar',  'dica_ajudou',        1, 25, 100)"
    );
    expect(sql).toContain(
      "('guardia',          'conectar',  'dica_protegeu',      5, 25, 100)"
    );
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

describe("as missões do laboratório são as da spec §6 (as trincas do protótipo)", () => {
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
