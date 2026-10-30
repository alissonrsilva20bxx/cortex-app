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
