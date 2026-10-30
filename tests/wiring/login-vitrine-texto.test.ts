import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS_AUTH } from "@/lib/textosAuth";

/**
 * R21 (auditoria do fluxo): a tela de entrada dizia "Gerencie jobs, agenda
 * e recebimentos." "jobs" é inglês; para a usuária o Job é o atendimento
 * (GLOSSARY.md). O texto vai para a constante, sem "jobs".
 */
const login = readFileSync(join(process.cwd(), "app/login/page.tsx"), "utf8");

describe("login: o texto de apresentação em português e em constante", () => {
  it("fala de atendimentos, não de jobs", () => {
    expect(TEXTOS_AUTH.vitrine.texto).toBe(
      "Gerencie atendimentos, agenda e recebimentos. Na Rede, troque indicações e encontre novas oportunidades."
    );
    expect(Object.values(TEXTOS_AUTH.vitrine).join(" ")).not.toMatch(
      /\bjobs?\b/i
    );
  });

  it("a tela usa a constante", () => {
    expect(login).toMatch(/TEXTOS_AUTH\.vitrine\.titulo/);
    expect(login).toMatch(/TEXTOS_AUTH\.vitrine\.destaque/);
    expect(login).toMatch(/TEXTOS_AUTH\.vitrine\.texto/);
    expect(login).not.toMatch(/Gerencie jobs/);
  });
});
