import { describe, expect, it } from "vitest";
import { TRIAL_DIAS, computeAssinatura } from "../../lib/assinatura";

describe("computeAssinatura", () => {
  it("starts in trial with the full 14 dias on day zero", () => {
    const inicio = new Date("2026-01-01T10:00:00.000Z");
    const ref = new Date("2026-01-01T10:00:00.000Z");
    const estado = computeAssinatura(inicio.toISOString(), "trial", ref);
    expect(estado).toEqual({ status: "trial", diasRestantes: TRIAL_DIAS });
  });

  it("counts down as days pass, rounding up a partial day", () => {
    const inicio = new Date("2026-01-01T00:00:00.000Z");
    const ref = new Date("2026-01-06T12:00:00.000Z"); // 5.5 dias decorridos
    const estado = computeAssinatura(inicio.toISOString(), "trial", ref);
    expect(estado.status).toBe("trial");
    expect(estado.diasRestantes).toBe(9); // 14 - 5.5 arredondado pra cima
  });

  it("flips to vencida the instant the 14 dias run out, by wall-clock date alone", () => {
    const inicio = new Date("2026-01-01T00:00:00.000Z");
    const ref = new Date("2026-01-15T00:00:00.000Z"); // exatamente 14 dias depois
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
