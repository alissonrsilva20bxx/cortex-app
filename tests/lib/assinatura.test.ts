import { describe, expect, it } from "vitest";
import {
  AVISO_FALTAM_DIAS,
  CORTE_TRIAL_7_DIAS,
  TRIAL_DIAS,
  TRIAL_DIAS_ANTIGO,
  computeAssinatura,
  diasDoTeste,
  estadoDaPilula,
} from "../../lib/assinatura";

/** Datas depois do corte: o teste de 7 dias. */
const NOVO = "2026-11-01T10:00:00.000Z";
/** Antes do corte: o teste antigo, de 14. */
const ANTIGO = "2026-09-20T10:00:00.000Z";
const mais = (iso: string, horas: number) =>
  new Date(new Date(iso).getTime() + horas * 3_600_000);

describe("computeAssinatura", () => {
  it("starts in trial with the full 7 dias on day zero", () => {
    const estado = computeAssinatura(NOVO, "trial", new Date(NOVO));
    expect(estado).toEqual({
      status: "trial",
      diasRestantes: TRIAL_DIAS,
      diasDoTeste: TRIAL_DIAS,
    });
  });

  it("counts down as days pass, rounding up a partial day", () => {
    const estado = computeAssinatura(NOVO, "trial", mais(NOVO, 60)); // 2,5 dias
    expect(estado.status).toBe("trial");
    expect(estado.diasRestantes).toBe(5); // 7 - 2.5 arredondado pra cima
  });

  it("flips to vencida the instant the 7 dias run out, by wall-clock date alone", () => {
    const estado = computeAssinatura(NOVO, "trial", mais(NOVO, 7 * 24));
    expect(estado).toEqual({
      status: "vencida",
      diasRestantes: 0,
      diasDoTeste: 7,
    });
  });

  it("stays vencida arbitrarily long after expiry, never negative days", () => {
    const estado = computeAssinatura(NOVO, "trial", mais(NOVO, 200 * 24));
    expect(estado).toEqual({
      status: "vencida",
      diasRestantes: 0,
      diasDoTeste: 7,
    });
  });

  it("reports ativa without touching trialStartedAt at all", () => {
    // string de data deliberadamente inválida — ativa nunca deveria nem
    // olhar pra ela, então isso não pode derrubar o cálculo.
    const estado = computeAssinatura("not-a-real-date", "ativa");
    expect(estado.status).toBe("ativa");
    expect(estado.diasRestantes).toBeNull();
  });

  it("ativa salva no banco vence de status mesmo se o trial já tivesse expirado por data", () => {
    const inicio = new Date("2020-01-01T00:00:00.000Z");
    const ref = new Date("2026-01-01T00:00:00.000Z");
    const estado = computeAssinatura(inicio.toISOString(), "ativa", ref);
    expect(estado.status).toBe("ativa");
  });
});

describe("duração do teste pela data de início (corte do onboarding Linha do tempo)", () => {
  it("7 dias para quem começa no onboarding novo, 14 para quem começou antes", () => {
    expect(TRIAL_DIAS).toBe(7);
    expect(TRIAL_DIAS_ANTIGO).toBe(14);
    expect(CORTE_TRIAL_7_DIAS).toBe("2026-10-09T00:00:00Z");
  });

  it("as duas pontas do corte: 1 ms antes = 14; no instante do corte = 7", () => {
    const corte = new Date(CORTE_TRIAL_7_DIAS).getTime();
    expect(diasDoTeste(new Date(corte - 1).toISOString())).toBe(14);
    expect(diasDoTeste(new Date(corte).toISOString())).toBe(7);
    expect(diasDoTeste(new Date(corte + 1).toISOString())).toBe(7);
  });

  it("data ilegível: o teste de agora (7)", () => {
    expect(diasDoTeste("not-a-real-date")).toBe(7);
  });

  it("conta antiga no dia 8 continua em teste, com 7 dias pela frente", () => {
    const estado = computeAssinatura(ANTIGO, "trial", mais(ANTIGO, 7 * 24));
    expect(estado).toEqual({
      status: "trial",
      diasRestantes: 7,
      diasDoTeste: 14,
    });
  });

  it("conta antiga vence só no dia 15", () => {
    expect(
      computeAssinatura(ANTIGO, "trial", mais(ANTIGO, 14 * 24 - 1)).status
    ).toBe("trial");
    expect(
      computeAssinatura(ANTIGO, "trial", mais(ANTIGO, 14 * 24)).status
    ).toBe("vencida");
  });

  it("conta nova vence no dia 8 (a mesma hora 7 dias depois)", () => {
    expect(
      computeAssinatura(NOVO, "trial", mais(NOVO, 7 * 24 - 1)).status
    ).toBe("trial");
    expect(computeAssinatura(NOVO, "trial", mais(NOVO, 7 * 24)).status).toBe(
      "vencida"
    );
  });

  it("vencida e ativa também levam a duração da conta (o título dos planos)", () => {
    expect(
      computeAssinatura(ANTIGO, "trial", mais(ANTIGO, 30 * 24)).diasDoTeste
    ).toBe(14);
    expect(computeAssinatura(ANTIGO, "ativa").diasDoTeste).toBe(14);
  });
});

describe("a pílula do contador", () => {
  it("1º dia: faltam 7, 1 bolinha acesa de 7", () => {
    const e = computeAssinatura(NOVO, "trial", new Date(NOVO));
    expect(estadoDaPilula(e)).toEqual({
      faltam: 7,
      feitos: 1,
      total: 7,
      ultimo: false,
    });
  });

  it("dia 5: faltam 3", () => {
    const e = computeAssinatura(NOVO, "trial", mais(NOVO, 4 * 24 + 1));
    expect(estadoDaPilula(e)).toEqual({
      faltam: 3,
      feitos: 5,
      total: 7,
      ultimo: false,
    });
  });

  it("dia 6: faltam 2, o dia do aviso (o mesmo da tela 3 do onboarding)", () => {
    const e = computeAssinatura(NOVO, "trial", mais(NOVO, 5 * 24 + 1));
    expect(estadoDaPilula(e)?.faltam).toBe(AVISO_FALTAM_DIAS);
    expect(AVISO_FALTAM_DIAS).toBe(2);
    expect(TRIAL_DIAS + 1 - AVISO_FALTAM_DIAS).toBe(6);
  });

  it("último dia: faltam 1, com o atalho dos planos", () => {
    const e = computeAssinatura(NOVO, "trial", mais(NOVO, 6 * 24 + 1));
    expect(estadoDaPilula(e)).toEqual({
      faltam: 1,
      feitos: 7,
      total: 7,
      ultimo: true,
    });
  });

  it("conta antiga: 14 bolinhas, faltam 14 no 1º dia", () => {
    const e = computeAssinatura(ANTIGO, "trial", new Date(ANTIGO));
    expect(estadoDaPilula(e)).toEqual({
      faltam: 14,
      feitos: 1,
      total: 14,
      ultimo: false,
    });
  });

  it("relógio torto (início no futuro): faltam fica no total, nunca acima", () => {
    expect(
      estadoDaPilula({ status: "trial", diasRestantes: 9, diasDoTeste: 7 })
    ).toEqual({ faltam: 7, feitos: 1, total: 7, ultimo: false });
  });

  it("nunca abaixo de 1 (último dia)", () => {
    expect(
      estadoDaPilula({ status: "trial", diasRestantes: 0, diasDoTeste: 7 })
    ).toEqual({ faltam: 1, feitos: 7, total: 7, ultimo: true });
  });

  it("fora do teste (vencida, ativa ou sem dado): sem pílula", () => {
    expect(estadoDaPilula(null)).toBeNull();
    expect(
      estadoDaPilula({ status: "vencida", diasRestantes: 0, diasDoTeste: 7 })
    ).toBeNull();
    expect(
      estadoDaPilula({ status: "ativa", diasRestantes: null, diasDoTeste: 7 })
    ).toBeNull();
  });
});
