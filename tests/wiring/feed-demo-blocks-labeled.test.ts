import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T12 rodada corretiva (PR #63), item 6 — confirma que o bloco contextual
 * do Feed ainda alimentado por fixture local (`DISCOVER_PEOPLE`, "Pessoas
 * que talvez você conheça") continua marcado `demo: true` e, por isso,
 * renderiza o aviso "Demonstração", e que os blocos com dado real
 * (solicitações de amizade, mensagens não lidas, e — desde a issue #64 —
 * "Desejo próximo da meta", agora lido de `wishlistItems` real em vez de
 * `WISHLIST_ITEMS` fixture) nunca são marcados como demo.
 */

const src = readFileSync(
  join(__dirname, "..", "..", "components", "rede", "FeedScreen.tsx"),
  "utf-8"
);

function blockDef(key: string): string {
  const match = src.match(new RegExp(`key: "${key}",[\\s\\S]*?\\n\\s+\\}\\);`));
  if (!match) throw new Error(`bloco "${key}" não encontrado`);
  return match[0];
}

describe("Feed — blocos fabricados continuam rotulados como demonstração", () => {
  it("o bloco 'descobrir' (fixture local) saiu do feed de vez -- sugestões fake no app real confundiam", () => {
    expect(src).not.toMatch(/key: "descobrir"/);
    expect(src).not.toMatch(/DISCOVER_PEOPLE/);
  });

  it("o bloco 'solicitacoes' (dado real, prop pendingRequestsCount) NÃO é demo", () => {
    expect(blockDef("solicitacoes")).not.toMatch(/demo: true/);
  });

  it("o bloco 'mensagens' (dado real, prop unreadChats) NÃO é demo", () => {
    expect(blockDef("mensagens")).not.toMatch(/demo: true/);
  });

  it("o bloco 'wishlist' (dado real desde a issue #64, prop wishlistItems) NÃO é demo", () => {
    expect(blockDef("wishlist")).not.toMatch(/demo: true/);
    expect(src).not.toMatch(/WISHLIST_ITEMS/);
  });

  it("sem bloco fabricado, nenhum bloco é demo nem mostra o rótulo 'Demonstração'", () => {
    expect(src).not.toMatch(/demo: true/);
    expect(src).not.toMatch(/Demonstração/);
  });
});
