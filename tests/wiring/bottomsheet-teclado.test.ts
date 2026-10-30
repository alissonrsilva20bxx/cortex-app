import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomSheet } from "@/components/ui/BottomSheet";

/**
 * R21 (auditoria, teclado no iPhone): só Novo atendimento, Nova Despesa e
 * Nova Entrada subiam acima do teclado (#176). As outras folhas usam o
 * BottomSheet comum (Novo Desejo, Editar perfil, Publicar, Cliente...) e o
 * teclado cobria os campos de baixo: no laboratório, com a área visível
 * em 508 px, a data do Desejo ficava em 521-571 e a bio em 639-733.
 * O BottomSheet liga o mesmo efeito: com teclado, sobe e cabe na área que
 * sobrou; sem teclado, as variáveis não existem e nada muda.
 */
const src = readFileSync(
  join(process.cwd(), "components/ui/BottomSheet.tsx"),
  "utf8"
);

function estiloDoPainel(): string {
  const html = renderToStaticMarkup(
    createElement(BottomSheet, {
      open: true,
      onClose: () => {},
      title: "Teste",
      children: null,
    })
  );
  return html.match(/role="dialog"[^>]*style="([^"]*)"/)?.[1] ?? "";
}

describe("BottomSheet: o campo focado fica acima do teclado", () => {
  it("liga o efeito do teclado ao painel enquanto está aberto", () => {
    expect(src).toMatch(/useCampoVisivelComTeclado\(panelRef, open\)/);
  });

  it("o painel sobe pelo recuo do teclado (0 sem teclado)", () => {
    expect(estiloDoPainel()).toContain("bottom:var(--teclado-inset, 0px)");
  });

  it("com teclado, o painel cabe na área que sobrou; sem teclado, sem limite", () => {
    expect(estiloDoPainel()).toContain(
      "max-height:calc(var(--teclado-altura-util, 100000px) * 0.9)"
    );
  });
});
