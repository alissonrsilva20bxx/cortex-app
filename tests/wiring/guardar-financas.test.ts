import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");

/**
 * Fiação do Guardar em Finanças: a tela chama a lógica real, o estado vazio
 * leva até a Rede e o card está na aba Metas. Os textos ficam em
 * lib/guardar/textos.ts (nada de texto solto no componente).
 */
describe("Guardar em Finanças está ligado de ponta a ponta", () => {
  const card = read("components/financeiro/GuardarCard.tsx");

  it("o card grava pelo serviço real e lê o histórico de volta", () => {
    expect(card).toContain("guardarNoDesejo(supabase");
    expect(card).toContain("listarHistoricoGuardar(supabase");
    expect(card).toContain("listarWishlistItems(supabase");
    expect(card).toContain("somarNoDesejo(supabase");
  });

  it("o estado vazio chama onCriarDesejo e a página leva à Rede", () => {
    expect(card).toContain("onClick={onCriarDesejo}");
    expect(read("app/page.tsx")).toContain(
      'onCriarDesejo={() => handleTabChange("rede")}'
    );
    expect(read("components/financeiro/FinanceiroTab.tsx")).toContain(
      "onCriarDesejo={onCriarDesejo}"
    );
  });

  it("a aba Metas mostra o card", () => {
    expect(read("components/financeiro/MetasTab.tsx")).toContain(
      "<GuardarCard userId={userId} onCriarDesejo={onCriarDesejo} />"
    );
  });

  it("não escreve texto de tela solto nem dado de exemplo", () => {
    expect(card).not.toMatch(/Você ainda não|Valor inválido|mock/i);
  });
});
