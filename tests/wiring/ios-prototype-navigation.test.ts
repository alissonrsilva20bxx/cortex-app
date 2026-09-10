import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  "components/ios-prototype/IosPrototypeApp.tsx",
  "utf8"
);
const styles = readFileSync(
  "components/ios-prototype/IosPrototypeApp.module.css",
  "utf8"
);

describe("protótipo iOS — contrato aprovado da barra inferior", () => {
  it("mantém somente os cinco destinos principais e deixa Ajustes fora da barra", () => {
    const navBlock = component.match(/const navItems[\s\S]*?\n\];/)?.[0];

    expect(navBlock).toBeDefined();
    expect(navBlock?.match(/^  \{ id:/gm)).toHaveLength(5);
    expect(navBlock).toContain('label: "Início"');
    expect(navBlock).toContain('label: "Agenda"');
    expect(navBlock).toContain('label: "Financeiro"');
    expect(navBlock).toContain('label: "Cofre"');
    expect(navBlock).toContain('label: "Rede"');
    expect(navBlock).not.toContain('label: "Ajustes"');
  });

  it("abre Ajustes pelo avatar e conserva visualmente a aba de origem", () => {
    expect(component).toMatch(/<AvatarButton onClick=\{openSettings\}/);
    expect(component).toContain(
      'active={active === "ajustes" ? previous : active}'
    );
  });

  it("preserva as proporções do modelo original expandido e compacto", () => {
    expect(styles).toMatch(
      /\.bottomNav \{[\s\S]*?left:18px;[\s\S]*?right:18px;[\s\S]*?bottom:calc\(18px \+[\s\S]*?padding:8px;/
    );
    expect(styles).toMatch(
      /\.navButton,\.navActive \{[^}]*width:44px;[^}]*height:44px;/
    );
    expect(styles).toMatch(/\.navActive \{ width:56px;/);
    expect(styles).toMatch(
      /\.bottomNavCompact \{ left:44px; right:44px; padding:3px; transform:translateY\(8px\);/
    );
    expect(styles).toMatch(/\.bottomNavCompact \.navActive \{ width:44px;/);
  });

  it("mantém os ícones no tamanho e peso da barra original", () => {
    expect(component).toContain(
      '<NavIcon size={20} strokeWidth={isActive ? 2.3 : 1.8} />'
    );
  });
});
