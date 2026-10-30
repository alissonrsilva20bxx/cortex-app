import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FAB } from "@/components/FAB";

/**
 * R21 (auditoria, acessibilidade): com o menu do "+" fechado, o painel
 * "Criar novo" só saía da tela por `transform`. O botão de dentro (ex.:
 * "Novo atendimento") continuava no leitor de tela e na ordem do Tab, um
 * botão invisível. Fechado, o painel fica `visibility: hidden` (depois do
 * deslize, como o BottomSheet); aberto, volta a ser visível.
 */
function estiloDoPainel(open: boolean): string {
  const html = renderToStaticMarkup(
    createElement(FAB, { activeTab: "home", open, onToggle: () => {} })
  );
  const antes = html.slice(0, html.indexOf("Criar novo"));
  const painel = antes.slice(antes.lastIndexOf('<div class="fixed left-0'));
  return painel.match(/style="([^"]*)"/)?.[1] ?? "";
}

describe("FAB: o menu fechado sai do leitor de tela", () => {
  it("fechado, o painel fica escondido depois do deslize", () => {
    const estilo = estiloDoPainel(false);
    expect(estilo).toContain("visibility:hidden");
    expect(estilo).toMatch(/transition-delay:0s, 300ms/);
  });

  it("aberto, o painel fica visível na hora", () => {
    const estilo = estiloDoPainel(true);
    expect(estilo).toContain("visibility:visible");
    expect(estilo).toMatch(/transition-delay:0s, 0s/);
  });
});
