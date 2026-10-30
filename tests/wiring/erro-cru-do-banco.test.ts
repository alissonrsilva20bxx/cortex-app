import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R21 (auditoria, erro e sem internet): quatro telas punham na tela a
 * mensagem crua do Supabase quando salvar falhava, em inglês (ex.: "TypeError:
 * Failed to fetch" sem internet, "new row violates row-level security
 * policy"). Agora mostram um texto em português de TEXTOS_ERRO.
 */
const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

const CASOS: Array<[string, RegExp, RegExp]> = [
  [
    "components/jobs/JobForm.tsx",
    /setError\(err\.message\)/,
    /if \(err\) return setError\(TEXTOS_ERRO\.salvar\);/,
  ],
  [
    "components/financeiro/MetaForm.tsx",
    /setError\(err\.message\)/,
    /if \(err\) return setError\(TEXTOS_ERRO\.salvar\);/,
  ],
  [
    "components/cofre/UploadSheet.tsx",
    /setError\(err\.message\)/,
    /if \(err\) return setError\(TEXTOS_ERRO\.enviarArquivo\);/,
  ],
  [
    "components/onboarding/OnboardingFlow.tsx",
    /setGoalError\(error\.message\)/,
    /if \(error\) return setGoalError\(TEXTOS_ERRO\.salvar\);/,
  ],
];

describe("a mensagem crua do banco não vai para a tela", () => {
  it.each(CASOS)("%s", (arquivo, cru, novo) => {
    const src = ler(arquivo);
    expect(src).not.toMatch(cru);
    expect(src).toMatch(novo);
    expect(src).toContain('import { TEXTOS_ERRO } from "@/lib/textosErro";');
  });

  it("os textos falam em português e dizem o que fazer", async () => {
    const { TEXTOS_ERRO } = await import("@/lib/textosErro");
    expect(TEXTOS_ERRO.salvar).toBe(
      "Não foi possível salvar. Confira a internet e tente de novo."
    );
    expect(TEXTOS_ERRO.enviarArquivo).toBe(
      "Não foi possível enviar o arquivo. Confira a internet ou tente um arquivo menor."
    );
  });
});
