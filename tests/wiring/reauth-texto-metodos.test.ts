import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  textoDaConfirmacao as texto,
  type MetodoReauth,
} from "@/lib/reauthRegras";

/**
 * R17 B5: "Confirme que é você" dizia "com a senha da sua conta ou com o
 * Google" até para conta só de e-mail, onde o botão do Google nem aparece.
 * O texto agora cita só o que a conta tem.
 */
describe("texto de 'Confirme que é você' pelo que a conta tem", () => {
  it("conta só de e-mail: não fala do Google", () => {
    expect(texto("desligar-pin", ["senha"])).toBe(
      "Para desligar o PIN, confirme que é você com a senha da sua conta."
    );
    expect(texto("esqueci-pin", ["senha"])).not.toContain("Google");
    expect(texto("trocar-pin", ["senha"])).not.toContain("Google");
  });

  it("conta só Google: não pede senha", () => {
    expect(texto("trocar-pin", ["google"])).toBe(
      "Para trocar o PIN, confirme que é você com o Google."
    );
  });

  it("as duas: cita as duas", () => {
    expect(texto("esqueci-pin", ["senha", "google"])).toBe(
      "Para criar um PIN novo, confirme que é você com a senha da sua conta ou com o Google. O PIN antigo não aparece em lugar nenhum."
    );
  });

  it("antes de saber (carregando) ou sem nenhum: não promete nenhum dos dois", () => {
    for (const m of [null, []] as const) {
      const t = texto("desligar-pin", m as MetodoReauth[] | null);
      expect(t).toBe("Para desligar o PIN, confirme que é você.");
    }
  });

  it("a folha usa o texto pelos métodos carregados", () => {
    const src = readFileSync(
      join(process.cwd(), "components/pin/ReauthModal.tsx"),
      "utf8"
    );
    expect(src).toMatch(/\{textoDaConfirmacao\(motivo, metodos\)\}/);
    expect(src).not.toMatch(/ou com o Google/);
  });
});
