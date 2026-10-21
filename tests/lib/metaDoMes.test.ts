import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HeroCard } from "@/components/home/HeroCard";
import { FaltaMetaCard } from "@/components/home/FaltaMetaCard";
import { FinanceiroHeroCard } from "@/components/financeiro/FinanceiroHeroCard";
import { calcEarnings, formatMoeda, monthProjection } from "@/lib/finance";
import type { Job, Meta, ReceitaAvulsa } from "@/lib/types";

/**
 * A meta do mês é um número só: atendimentos concluídos + entradas avulsas
 * (calcEarnings). A entrada avulsa precisa mover o card do Início, o
 * "Falta pra meta" e o card Meta do Financeiro, e bater com a aba Metas.
 */
const HOJE = new Date();
const dia = (n: number) => {
  const d = new Date(HOJE.getFullYear(), HOJE.getMonth(), n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const job: Job = {
  id: "j1",
  clienteNome: "Ana",
  data: dia(1),
  hora: "10:00",
  valor: 400,
  modalidade: "presencial",
  status: "concluído",
  criadoEm: dia(1),
  pagoEm: null,
};
const metas: Meta[] = [{ periodo: "mes", valorAlvo: 1000 }];
const avulsa: ReceitaAvulsa = {
  id: "r1",
  descricao: "Venda",
  valor: 100,
  categoria: "outros",
  data: dia(1),
  criadoEm: dia(1),
};

const brl = (v: number) => formatMoeda(v).replace(/[\s\u00a0\u202f]+/g, " ");

const texto = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/[\s\u00a0\u202f]+/g, " ");

function heroFinanceiro(receitas: ReceitaAvulsa[]) {
  const entrou = calcEarnings([job], receitas, "mes");
  return texto(
    createElement(FinanceiroHeroCard, {
      jobs: [job],
      receitas,
      despesas: [],
      totalEntradaMes: entrou,
      totalDespMes: 0,
      saldo: entrou,
      metas,
    })
  );
}

describe("meta do mês: um número só", () => {
  it("a entrada avulsa move a conta da projeção (Início)", () => {
    expect(monthProjection([job], metas, []).earned).toBe(400);
    const p = monthProjection([job], metas, [avulsa]);
    expect(p.earned).toBe(500);
    expect(p.remaining).toBe(500);
    expect(p.pct).toBe(50);
  });

  it("a entrada avulsa move o card principal do Início", () => {
    const sem = texto(
      createElement(HeroCard, {
        jobs: [job],
        metas,
        receitas: [],
        onGoToFinanceiro: () => {},
      })
    );
    const com = texto(
      createElement(HeroCard, {
        jobs: [job],
        metas,
        receitas: [avulsa],
        onGoToFinanceiro: () => {},
      })
    );
    expect(sem).toContain(brl(400));
    expect(sem).toContain("40% da meta");
    expect(com).toContain(brl(500));
    expect(com).toContain("50% da meta");
  });

  it("a entrada avulsa move o Falta pra meta do Início", () => {
    const sem = texto(
      createElement(FaltaMetaCard, {
        jobs: [job],
        metas,
        receitas: [],
        onGoToFinanceiro: () => {},
      })
    );
    const com = texto(
      createElement(FaltaMetaCard, {
        jobs: [job],
        metas,
        receitas: [avulsa],
        onGoToFinanceiro: () => {},
      })
    );
    expect(sem).toContain(brl(600));
    expect(com).toContain(brl(500));
  });

  it("a entrada avulsa move o card Meta do Financeiro", () => {
    expect(heroFinanceiro([])).toContain(`40% ${brl(400)} de ${brl(1000)}`);
    expect(heroFinanceiro([avulsa])).toContain(
      `50% ${brl(500)} de ${brl(1000)}`
    );
  });

  it("os três lugares usam a conta da aba Metas (calcEarnings do mês)", () => {
    const aba = calcEarnings([job], [avulsa], "mes");
    expect(monthProjection([job], metas, [avulsa]).earned).toBe(aba);
    expect(heroFinanceiro([avulsa])).toContain(brl(aba));
  });

  it("a Início busca receitas_avulsas junto com jobs e metas e repassa aos cards", () => {
    const page = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    expect(page).toContain('supabase.from("receitas_avulsas")');
    expect(page.match(/receitas=\{receitas\}/g)?.length).toBeGreaterThanOrEqual(
      2
    );
  });
});
