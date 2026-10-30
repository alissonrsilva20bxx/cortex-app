import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS_ERRO } from "@/lib/textosErro";

/**
 * R22 (B2), com o caso parecido dos Ajustes que a R21 deixou aberto
 * (achado 15): quando ativar ou desativar a notificação falhava, a tela
 * mostrava a mensagem crua do erro. Ela vem do navegador ("Registration
 * failed - push service error") ou do banco ("new row violates row-level
 * security policy") em inglês, e não é para a pessoa ler. Agora as duas
 * telas mostram um texto nosso, em português, de TEXTOS_ERRO.
 */

const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

const tour = ler("components/onboarding/AppTour.tsx");
const ajustes = ler("components/ajustes/AjustesTab.tsx");

describe("erro de notificação não sai cru na tela", () => {
  it("o Tour mostra texto nosso, em português", () => {
    expect(tour).not.toMatch(/setPushErro\(\s*e instanceof Error/);
    expect(tour).not.toMatch(/e\.message/);
    expect(tour).toMatch(/setPushErro\(TEXTOS_ERRO\.notificacao\.ativar\)/);
    expect(tour).toContain('import { TEXTOS_ERRO } from "@/lib/textosErro";');
  });

  it("os Ajustes também (ativar e desativar)", () => {
    expect(ajustes).not.toMatch(/err instanceof Error \? err\.message/);
    expect(ajustes).toMatch(/setPushError\(TEXTOS_ERRO\.notificacao\.ativar\)/);
    expect(ajustes).toMatch(
      /setPushError\(TEXTOS_ERRO\.notificacao\.desativar\)/
    );
    expect(ajustes).toContain('import { TEXTOS_ERRO } from "@/lib/textosErro";');
  });

  it("os textos dizem o que fazer, sem jargão", () => {
    expect(TEXTOS_ERRO.notificacao.ativar).toBe(
      "Não foi possível ativar as notificações. Confira a permissão nas configurações e tente de novo."
    );
    expect(TEXTOS_ERRO.notificacao.desativar).toBe(
      "Não foi possível desativar as notificações. Tente de novo."
    );
  });
});
