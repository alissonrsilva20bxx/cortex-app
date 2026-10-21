import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");

/**
 * Fiação do Guardar em Finanças: a tela chama a lógica real, o estado vazio
 * fica desabilitado sem Desejo e o card está na aba Metas. Os textos ficam em
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

  it("o Guardar vazio não tem botão de criar Desejo e deixa campo e botão desabilitados", () => {
    expect(card).not.toContain("onCriarDesejo");
    expect(card).not.toContain("Criar um Desejo");
    expect(card).toContain("const semDesejo = desejos.length === 0");
    expect(card).toContain(
      "disabled={semDesejo || salvando || Boolean(pendente)}"
    );
    expect(card).toContain(
      "aria-disabled={semDesejo || salvando || Boolean(pendente)}"
    );
    expect(card).toContain("{T.ajudaSemDesejo}");
    expect(card).toContain("{salvando ? T.botaoSalvando : T.botao}");
    const textos = read("lib/guardar/textos.ts");
    expect(textos).toContain(
      'ajudaSemDesejo: "Crie um Desejo acima para guardar."'
    );
    expect(textos).toContain('botao: "Guardar"');
    expect(textos).not.toContain("Criar um Desejo");
    const metas = read("components/financeiro/MetasTab.tsx");
    expect(metas).not.toContain("onCriarDesejo");
    expect(read("app/page.tsx")).not.toContain("onCriarDesejo");
  });

  it("o único lugar de criar Desejo em Finanças é o DesejosCard", () => {
    const desejos = read("components/financeiro/DesejosCard.tsx");
    expect(desejos).toContain("{T.criar}");
    expect(desejos).toMatch(/onClick=\{abrirNovo\}[\s\S]*\{T\.criar\}/);
    expect(read("lib/desejo/textos.ts")).toContain('criar: "Criar um Desejo"');
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
