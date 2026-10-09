import { describe, expect, it } from "vitest";
import {
  cenarioDaCobranca,
  centavos,
  chaveDeTeste,
  emSegundos,
  fimDoTeste,
  formatarDDMM,
  inicioDaCobranca,
  nomeDoPeriodo,
  renovaEm,
  statusPeloStripe,
} from "@/lib/pagamento/regras";
import { PLANOS, planoPorId } from "@/lib/planos";

const local = (a: number, m: number, d: number, h = 10) =>
  new Date(a, m - 1, d, h, 0, 0);

describe("planos em euro (os mesmos do onboarding)", () => {
  it("1 mês € 15, 2 meses € 25, 3 meses € 30, em centavos para o Stripe", () => {
    expect(PLANOS.map((p) => [p.meses, p.preco])).toEqual([
      [1, 15],
      [2, 25],
      [3, 30],
    ]);
    expect(centavos(planoPorId("1m"))).toBe(1500);
    expect(centavos(planoPorId("2m"))).toBe(2500);
    expect(centavos(planoPorId("3m"))).toBe(3000);
  });

  it("período: 1 mês / 3 meses", () => {
    expect(nomeDoPeriodo(1)).toBe("1 mês");
    expect(nomeDoPeriodo(3)).toBe("3 meses");
  });
});

describe("quando cobra: hoje ou no fim do teste", () => {
  it("teste de 7 dias (começou depois do corte) termina 7 dias depois", () => {
    const inicio = local(2026, 10, 10).toISOString();
    expect(fimDoTeste(inicio).getTime()).toBe(local(2026, 10, 17).getTime());
  });

  it("conta antiga (antes do corte) tem 14 dias", () => {
    const inicio = local(2026, 10, 1).toISOString();
    expect(fimDoTeste(inicio).getTime()).toBe(local(2026, 10, 15).getTime());
  });

  it("assinando com o teste correndo: nada hoje, primeira cobrança no fim do teste", () => {
    const c = cenarioDaCobranca(
      local(2026, 10, 10).toISOString(),
      local(2026, 10, 12)
    );
    expect(c.tipo).toBe("fimDoTeste");
    expect(c.tipo === "fimDoTeste" && formatarDDMM(c.em)).toBe("17/10");
    expect(formatarDDMM(inicioDaCobranca(c, local(2026, 10, 12)))).toBe(
      "17/10"
    );
  });

  it("teste acabou: paga hoje", () => {
    const c = cenarioDaCobranca(
      local(2026, 10, 10).toISOString(),
      local(2026, 10, 18)
    );
    expect(c).toEqual({ tipo: "agora" });
    expect(formatarDDMM(inicioDaCobranca(c, local(2026, 10, 18)))).toBe(
      "18/10"
    );
  });

  it("no instante exato do fim do teste já é 'agora'", () => {
    const inicio = local(2026, 10, 10).toISOString();
    expect(cenarioDaCobranca(inicio, fimDoTeste(inicio))).toEqual({
      tipo: "agora",
    });
  });

  it("sem data ou data ilegível: paga hoje (nunca promete um teste que não existe)", () => {
    expect(cenarioDaCobranca(null)).toEqual({ tipo: "agora" });
    expect(cenarioDaCobranca(undefined)).toEqual({ tipo: "agora" });
    expect(cenarioDaCobranca("lixo")).toEqual({ tipo: "agora" });
  });

  it("trial_end em segundos", () => {
    expect(emSegundos(new Date(1_700_000_000_999))).toBe(1_700_000_000);
  });
});

describe("renovação e datas do desenho", () => {
  it("15/10 + 1, 2, 3 meses = 15/11, 15/12, 15/01", () => {
    const d = local(2026, 10, 15);
    expect([1, 2, 3].map((m) => formatarDDMM(renovaEm(d, m)))).toEqual([
      "15/11",
      "15/12",
      "15/01",
    ]);
  });

  it("31/01 + 1 mês = último dia de fevereiro (não pula para março)", () => {
    expect(formatarDDMM(renovaEm(local(2027, 1, 31), 1))).toBe("28/02");
    expect(formatarDDMM(renovaEm(local(2028, 1, 31), 1))).toBe("29/02");
  });
});

describe("assinatura_status a partir do Stripe", () => {
  it("pagou ou assinou no teste: ativa", () => {
    expect(statusPeloStripe("active")).toBe("ativa");
    expect(statusPeloStripe("trialing")).toBe("ativa");
    expect(statusPeloStripe("past_due")).toBe("ativa");
  });

  it("cancelada ou sem pagamento: volta a 'trial' (a data decide)", () => {
    expect(statusPeloStripe("canceled")).toBe("trial");
    expect(statusPeloStripe("unpaid")).toBe("trial");
    expect(statusPeloStripe("incomplete_expired")).toBe("trial");
  });

  it("pagamento ainda em andamento ou desconhecido: não muda nada", () => {
    expect(statusPeloStripe("incomplete")).toBeNull();
    expect(statusPeloStripe("paused")).toBeNull();
    expect(statusPeloStripe(null)).toBeNull();
  });

  it("modo teste pelas chaves", () => {
    expect(chaveDeTeste("pk_test_123")).toBe(true);
    expect(chaveDeTeste("sk_test_123")).toBe(true);
    expect(chaveDeTeste("pk_live_123")).toBe(false);
    expect(chaveDeTeste("")).toBe(false);
  });
});
