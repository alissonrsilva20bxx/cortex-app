import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS_PLANOS } from "@/lib/textosPlanos";

/**
 * R22 (B3): na tela de erro do pagamento, o app mostrava a mensagem do
 * Stripe como ela vem, entre aspas, com os códigos técnicos ao lado
 * ("código card_declined · insufficient_funds"). O texto do Stripe depende
 * do idioma dele e o código não diz nada para a pessoa. Agora a tela mostra
 * um texto nosso, em português, e o motivo da recusa continua vindo de
 * motivoDaRecusa (que já era em português).
 */

const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

const tela = ler("components/pagamento/PagamentoTela.tsx");
const css = ler("components/pagamento/pagamento.module.css");

describe("o erro do pagamento não mostra a mensagem crua do Stripe", () => {
  it("a mensagem do Stripe e os códigos técnicos saem da tela", () => {
    expect(tela).not.toMatch(/erro\?\.message/);
    expect(tela).not.toMatch(/erro\.code/);
    expect(tela).not.toMatch(/decline_code\}/);
    expect(tela).not.toMatch(/Mensagem do Stripe/);
  });

  it("no lugar entra o texto nosso, em português", () => {
    expect(tela).toMatch(/TEXTOS_PLANOS\.pagamento\.recusa/);
    expect(tela).toContain('import { TEXTOS_PLANOS } from "@/lib/textosPlanos";');
    expect(TEXTOS_PLANOS.pagamento.recusa).toBe(
      "Confira os dados do cartão e tente de novo. Se continuar, use outro cartão."
    );
  });

  it("o Payment Element continua em português", () => {
    expect(tela).toMatch(/locale: "pt-BR"/);
  });

  it("o comentário do arquivo não promete mais a mensagem do Stripe", () => {
    expect(tela).not.toMatch(/a mensagem do Stripe, traduzida/);
  });

  it("não sobra estilo para o código que saiu", () => {
    expect(css).not.toMatch(/\.stripeMsg code/);
    // R23: o último <b> de dentro da caixa saiu junto (o motivo da recusa
    // agora é texto do parágrafo), então o estilo dele também sai.
    expect(css).not.toMatch(/\.stripeMsg b/);
  });
});
