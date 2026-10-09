import { describe, expect, it } from "vitest";
import {
  TRIAL_DIAS,
  computeAssinatura,
  estadoDaPilula,
} from "../../lib/assinatura";

describe("computeAssinatura", () => {
  it("starts in trial with the full 7 dias on day zero", () => {
    const inicio = new Date("2026-01-01T10:00:00.000Z");
    const ref = new Date("2026-01-01T10:00:00.000Z");
    const estado = computeAssinatura(inicio.toISOString(), "trial", ref);
    expect(estado).toEqual({ status: "trial", diasRestantes: TRIAL_DIAS });
  });

  it("counts down as days pass, rounding up a partial day", () => {
    const inicio = new Date("2026-01-01T00:00:00.000Z");
    const ref = new Date("2026-01-03T12:00:00.000Z"); // 2.5 dias decorridos
    const estado = computeAssinatura(inicio.toISOString(), "trial", ref);
    expect(estado.status).toBe("trial");
    expect(estado.diasRestantes).toBe(5); // 7 - 2.5 arredondado pra cima
  });

  it("flips to vencida the instant the 7 dias run out, by wall-clock date alone", () => {
    const inicio = new Date("2026-01-01T00:00:00.000Z");
    const ref = new Date("2026-01-08T00:00:00.000Z"); // exatamente 7 dias depois
    const estado = computeAssinatura(inicio.toISOString(), "trial", ref);
    expect(estado).toEqual({ status: "vencida", diasRestantes: 0 });
  });

  it("stays vencida arbitrarily long after expiry, never negative days", () => {
    const inicio = new Date("2026-01-01T00:00:00.000Z");
    const ref = new Date("2026-06-01T00:00:00.000Z");
    const estado = computeAssinatura(inicio.toISOString(), "trial", ref);
    expect(estado).toEqual({ status: "vencida", diasRestantes: 0 });
  });

  it("reports ativa without touching trialStartedAt at all", () => {
    // string de data deliberadamente inválida — ativa nunca deveria nem
    // olhar pra ela, então isso não pode derrubar o cálculo.
    const estado = computeAssinatura("not-a-real-date", "ativa");
    expect(estado).toEqual({ status: "ativa", diasRestantes: null });
  });

  it("ativa salva no banco vence de status mesmo se o trial já tivesse expirado por data", () => {
    const inicio = new Date("2020-01-01T00:00:00.000Z");
    const ref = new Date("2026-01-01T00:00:00.000Z");
    const estado = computeAssinatura(inicio.toISOString(), "ativa", ref);
    expect(estado.status).toBe("ativa");
  });
});

describe("TRIAL_DIAS e a pílula do contador", () => {
  it("o teste grátis é de 7 dias (onboarding Linha do tempo)", () => {
    expect(TRIAL_DIAS).toBe(7);
  });

  it("1º dia: faltam 7, 1 bolinha acesa", () => {
    const inicio = new Date("2026-01-01T10:00:00.000Z");
    const e = computeAssinatura(inicio.toISOString(), "trial", inicio);
    expect(estadoDaPilula(e)).toEqual({ faltam: 7, feitos: 1, ultimo: false });
  });

  it("dia 5: faltam 3", () => {
    const inicio = new Date("2026-01-01T10:00:00.000Z");
    const ref = new Date("2026-01-05T11:00:00.000Z");
    const e = computeAssinatura(inicio.toISOString(), "trial", ref);
    expect(estadoDaPilula(e)).toEqual({ faltam: 3, feitos: 5, ultimo: false });
  });

  it("último dia: faltam 1, com o atalho dos planos", () => {
    const inicio = new Date("2026-01-01T10:00:00.000Z");
    const ref = new Date("2026-01-07T11:00:00.000Z");
    const e = computeAssinatura(inicio.toISOString(), "trial", ref);
    expect(estadoDaPilula(e)).toEqual({ faltam: 1, feitos: 7, ultimo: true });
  });

  it("fora do teste (vencida, ativa ou sem dado): sem pílula", () => {
    expect(estadoDaPilula(null)).toBeNull();
    expect(estadoDaPilula({ status: "vencida", diasRestantes: 0 })).toBeNull();
    expect(estadoDaPilula({ status: "ativa", diasRestantes: null })).toBeNull();
  });
});
