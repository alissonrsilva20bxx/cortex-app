import { describe, expect, it } from "vitest";
import {
  aplicarCasoFinanceiro,
  buildMockAppSeed,
  ehCasoFinanceiro,
} from "@/lib/mockAppData";
import { calcEarnings, monthExpenses } from "@/lib/finance";
import type { Despesa, Job, ReceitaAvulsa } from "@/lib/types";

/**
 * `?financeiro=` do laboratório: os 3 meses da barra entrou x saiu do
 * "Saldo do mês" (zerado, só entradas, só saídas), conferidos com as MESMAS
 * contas do Financeiro (calcEarnings / monthExpenses).
 */
function totais(caso: Parameters<typeof aplicarCasoFinanceiro>[1]) {
  const t = aplicarCasoFinanceiro(buildMockAppSeed(), caso).tables;
  return {
    entrou: calcEarnings(
      (t.jobs ?? []) as unknown as Job[],
      (t.receitas_avulsas ?? []) as unknown as ReceitaAvulsa[],
      "mes"
    ),
    saiu: monthExpenses((t.despesas ?? []) as unknown as Despesa[]),
  };
}

describe("casos do Financeiro no laboratório", () => {
  it("sem parâmetro: a semente de sempre, com entrada e saída no mês", () => {
    const { entrou, saiu } = totais(null);
    expect(entrou).toBeGreaterThan(0);
    expect(saiu).toBeGreaterThan(0);
  });

  it("vazio: R$ 0 de entrada e R$ 0 de saída", () => {
    expect(totais("vazio")).toEqual({ entrou: 0, saiu: 0 });
  });

  it("só entradas: entrada > 0, saída R$ 0", () => {
    const { entrou, saiu } = totais("so-entradas");
    expect(entrou).toBeGreaterThan(0);
    expect(saiu).toBe(0);
  });

  it("só saídas: entrada R$ 0, saída > 0", () => {
    const { entrou, saiu } = totais("so-saidas");
    expect(entrou).toBe(0);
    expect(saiu).toBeGreaterThan(0);
  });

  it("vazio e só saídas: nenhuma entrada em mês nenhum (não depende da data de hoje)", () => {
    for (const caso of ["vazio", "so-saidas"] as const) {
      const t = aplicarCasoFinanceiro(buildMockAppSeed(), caso).tables;
      expect(t.receitas_avulsas ?? []).toHaveLength(0);
      expect(
        ((t.jobs ?? []) as unknown as Job[]).filter(
          (j) => j.status === "concluído"
        )
      ).toHaveLength(0);
    }
    expect(
      aplicarCasoFinanceiro(buildMockAppSeed(), null).tables.receitas_avulsas
    ).not.toHaveLength(0);
  });

  it("só aceita os 3 nomes", () => {
    expect(ehCasoFinanceiro("vazio")).toBe(true);
    expect(ehCasoFinanceiro("so-entradas")).toBe(true);
    expect(ehCasoFinanceiro("so-saidas")).toBe(true);
    expect(ehCasoFinanceiro("tudo")).toBe(false);
    expect(ehCasoFinanceiro(null)).toBe(false);
  });
});
