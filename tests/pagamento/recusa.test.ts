import { describe, expect, it } from "vitest";
import {
  ehSaldoInsuficiente,
  motivoDaRecusa,
  recadoDaRecusa,
} from "@/lib/pagamento/cliente";
import { TEXTOS_PLANOS } from "@/lib/textosPlanos";

/**
 * R25: a tela de erro do pagamento fechava com "Confira os dados do cartão
 * e tente de novo" para QUALQUER recusa. Com saldo insuficiente o cartão
 * está certo -- falta limite --, então o conselho mandava a pessoa conferir
 * o que já estava certo. Agora saldo insuficiente tem motivo e recado
 * próprios; os outros motivos continuam com o recado de conferir os dados.
 */
describe("recusa do pagamento: o recado combina com o motivo", () => {
  it("saldo insuficiente: motivo e recado próprios", () => {
    const erro = { code: "card_declined", decline_code: "insufficient_funds" };
    expect(motivoDaRecusa(erro)).toBe("saldo insuficiente");
    expect(ehSaldoInsuficiente(erro)).toBe(true);
    expect(recadoDaRecusa(erro)).toBe(TEXTOS_PLANOS.pagamento.recusaSaldo);
  });

  it("o recado do saldo não manda conferir os dados", () => {
    expect(TEXTOS_PLANOS.pagamento.recusaSaldo).not.toMatch(/confira os dados/i);
    expect(TEXTOS_PLANOS.pagamento.recusaSaldo).not.toBe(
      TEXTOS_PLANOS.pagamento.recusa
    );
  });

  it("os outros motivos continuam com o recado de conferir os dados", () => {
    const outros = [
      { decline_code: "expired_card" },
      { decline_code: "incorrect_cvc" },
      { decline_code: "lost_card" },
      { decline_code: "processing_error" },
      { decline_code: "authentication_required" },
      { code: "card_declined" },
    ];
    for (const erro of outros) {
      expect(ehSaldoInsuficiente(erro)).toBe(false);
      expect(recadoDaRecusa(erro)).toBe(TEXTOS_PLANOS.pagamento.recusa);
    }
  });

  it("sem erro nenhum, o recado é o de sempre", () => {
    expect(ehSaldoInsuficiente(null)).toBe(false);
    expect(ehSaldoInsuficiente(undefined)).toBe(false);
    expect(recadoDaRecusa(null)).toBe(TEXTOS_PLANOS.pagamento.recusa);
    expect(recadoDaRecusa(undefined)).toBe(TEXTOS_PLANOS.pagamento.recusa);
  });

  it("sem decline_code, o code insufficient_funds também conta", () => {
    expect(ehSaldoInsuficiente({ code: "insufficient_funds" })).toBe(true);
  });
});
