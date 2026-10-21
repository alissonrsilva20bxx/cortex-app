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

  it("o estado vazio chama onCriarDesejo, que abre o formulário de Desejo em Finanças (não leva à Rede)", () => {
    expect(card).toContain("onClick={onCriarDesejo}");
    const metas = read("components/financeiro/MetasTab.tsx");
    expect(metas).toContain(
      "onCriarDesejo={() => setPedidoNovoDesejo((n) => n + 1)}"
    );
    expect(metas).toContain("pedidoNovo={pedidoNovoDesejo}");
    expect(metas).not.toContain('handleTabChange("rede")');
    expect(read("app/page.tsx")).not.toContain(
      'onCriarDesejo={() => handleTabChange("rede")}'
    );
    // o card de Desejos abre o formulário quando o pedido sobe
    expect(read("components/financeiro/DesejosCard.tsx")).toMatch(
      /if \(pedidoNovo > 0\) abrirNovo\(\)/
    );
  });

  it("a aba Metas mostra o card", () => {
    const metas = read("components/financeiro/MetasTab.tsx");
    expect(metas).toContain("<GuardarCard");
    expect(metas).toContain("userId={userId}");
    expect(metas).toContain("<DesejosCard");
  });

  it("não escreve texto de tela solto nem dado de exemplo", () => {
    expect(card).not.toMatch(/Você ainda não|Valor inválido|mock/i);
  });
});
