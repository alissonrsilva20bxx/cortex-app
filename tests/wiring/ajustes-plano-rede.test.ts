import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS_PLANOS } from "@/lib/textosPlanos";

/**
 * R19rev #3: o plano pago se chama só "Rede" (capitão, 27/10). Nos Ajustes,
 * a linha da conta dizia "Assinatura". O rótulo visível agora é "Plano
 * Rede", numa constante. Os nomes técnicos (assinatura_status, Stripe,
 * computeAssinatura) não mudam.
 */

const ajustes = readFileSync(
  join(process.cwd(), "components/ajustes/AjustesTab.tsx"),
  "utf8"
);

describe("Ajustes: o plano pago aparece como Rede", () => {
  it("o rótulo da linha é 'Plano Rede'", () => {
    expect(TEXTOS_PLANOS.ajustesLinha).toBe("Plano Rede");
  });

  it("a linha da conta usa a constante, não 'Assinatura'", () => {
    expect(ajustes).toMatch(/title=\{TEXTOS_PLANOS\.ajustesLinha\}/);
    expect(ajustes).not.toMatch(/title="Assinatura"/);
  });

  it("os nomes técnicos seguem os mesmos", () => {
    expect(ajustes).toMatch(/assinatura_status/);
    expect(ajustes).toMatch(/computeAssinatura\(/);
  });
});

/**
 * R19b, achados fora da tarefa: o valor ao lado de "Plano Rede" e o erro
 * "Sua assinatura já está ativa." estavam no código, fora de constante, e o
 * erro ainda chamava o plano de "assinatura".
 */
describe("textos do plano em constante", () => {
  const rota = readFileSync(
    join(process.cwd(), "app/api/pagamento/assinatura/route.ts"),
    "utf8"
  );

  it("o valor da linha do plano vem de TEXTOS_PLANOS.ajustesValor", () => {
    expect(TEXTOS_PLANOS.ajustesValor.teste(4)).toBe("Teste grátis · 4 dias");
    expect(TEXTOS_PLANOS.ajustesValor.teste(1)).toBe("Teste grátis · 1 dia");
    expect(TEXTOS_PLANOS.ajustesValor.terminou).toBe("Teste terminou");
    expect(TEXTOS_PLANOS.ajustesValor.ativa).toBe("Ativa");
    expect(ajustes).toMatch(
      /TEXTOS_PLANOS\.ajustesValor\.teste\(estadoAssinatura\.diasRestantes\)/
    );
    expect(ajustes).toMatch(/TEXTOS_PLANOS\.ajustesValor\.terminou/);
    expect(ajustes).toMatch(/TEXTOS_PLANOS\.ajustesValor\.ativa/);
    expect(ajustes).not.toMatch(/Teste grátis ·|"Teste terminou"|"Ativa"/);
  });

  it("o erro de plano já ativo fala da Rede e vem da constante", () => {
    expect(TEXTOS_PLANOS.jaAtiva).toBe("Seu Plano Rede já está ativo.");
    expect(rota).not.toMatch(/Sua assinatura já está ativa/);
    expect(rota.match(/\{ error: TEXTOS_PLANOS\.jaAtiva \}/g)).toHaveLength(2);
  });
});
