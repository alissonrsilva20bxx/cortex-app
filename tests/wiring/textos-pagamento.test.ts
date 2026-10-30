import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS_PLANOS } from "@/lib/textosPlanos";

/**
 * R20, achados fora da tarefa: os erros do pagamento que a pessoa vê
 * (rota da assinatura e o lado do aparelho) estavam escritos no código.
 * Agora vêm de TEXTOS_PLANOS.pagamento, com o mesmo texto.
 */

const ler = (arquivo: string) =>
  readFileSync(join(process.cwd(), arquivo), "utf8");
const rota = ler("app/api/pagamento/assinatura/route.ts");
const cliente = ler("lib/pagamento/cliente.ts");

describe("erros do pagamento em constante", () => {
  it("os textos são os mesmos de antes", () => {
    expect(TEXTOS_PLANOS.pagamento.planoInvalido).toBe("Plano inválido");
    expect(TEXTOS_PLANOS.pagamento.naoIniciou).toBe(
      "Não foi possível iniciar o pagamento agora."
    );
    expect(TEXTOS_PLANOS.pagamento.semConexao).toBe(
      "Sem conexão. Tente de novo."
    );
  });

  it("a rota da assinatura usa a constante", () => {
    expect(rota).toMatch(/error: TEXTOS_PLANOS\.pagamento\.planoInvalido/);
    expect(rota).toMatch(/error: TEXTOS_PLANOS\.pagamento\.naoIniciou/);
    expect(rota).not.toMatch(/"Plano inválido"|"Não foi possível iniciar/);
  });

  it("o lado do aparelho usa a constante", () => {
    expect(cliente).toMatch(
      /json\.error \?\? TEXTOS_PLANOS\.pagamento\.naoIniciou/
    );
    expect(cliente).toMatch(/erro: TEXTOS_PLANOS\.pagamento\.semConexao/);
    expect(cliente).not.toMatch(
      /"Não foi possível iniciar|"Sem conexão\. Tente de novo\."/
    );
  });
});
