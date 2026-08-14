import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T12 rodada corretiva (PR #63) — WishlistScreen.tsx e ClientesScreen.tsx
 * são 100% `useState` local, sem tabela Supabase por trás (qualquer edição
 * some no próximo reload), mas — diferente dos blocos "Demonstração" já
 * rotulados no Feed (T7) — não tinham nenhum aviso disso, alcançáveis por
 * navegação normal a partir de "Meu Espaço". Uma testadora real podia achar
 * que estava cadastrando clientes/desejos de verdade. Mesmo padrão de
 * inspeção de código-fonte já usado em rede-gap-visual.test.ts.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const DEMO_LABEL =
  "Demonstração — sem tabela real ainda, não persiste entre sessões";

describe("Wishlist/Clientes — telas sem persistência real rotuladas como demonstração", () => {
  it("WishlistScreen exibe o rótulo de demonstração", () => {
    const src = read("components/rede/WishlistScreen.tsx");
    expect(src).toContain(DEMO_LABEL);
  });

  it("ClientesScreen exibe o rótulo de demonstração", () => {
    const src = read("components/rede/ClientesScreen.tsx");
    expect(src).toContain(DEMO_LABEL);
  });

  it("MeuEspacoScreen rotula a prévia de Desejos, assim como já fazia com a de Clientes", () => {
    const src = read("components/rede/MeuEspacoScreen.tsx");
    const occurrences = [...src.matchAll(new RegExp(DEMO_LABEL, "g"))].length;
    expect(occurrences).toBe(2);
  });
});
