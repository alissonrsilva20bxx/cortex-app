import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * R17 B3: endereço que não existe mostrava a página 404 padrão do Next, em
 * inglês ("This page could not be found"), sem caminho de volta.
 */
describe("app/not-found.tsx", () => {
  it("em português, com botão de volta ao início", async () => {
    const { default: NaoEncontrada } = await import("../../app/not-found");
    const html = renderToStaticMarkup(createElement(NaoEncontrada));
    expect(html).toContain("Página não encontrada");
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>[^<]*Voltar ao início/);
    expect(html).not.toMatch(/could not be found/i);
  });
});
