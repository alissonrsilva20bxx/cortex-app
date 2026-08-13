import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T12 rodada corretiva (PR #63), item 6 — confirma que os blocos
 * contextuais do Feed alimentados por `lib/mockRede.ts` ("Pessoas que
 * talvez você conheça", "Desejo próximo da meta") continuam marcados
 * `demo: true` e, por isso, renderizam o aviso "Demonstração", e que os
 * blocos reais (solicitações de amizade, mensagens não lidas — contagens
 * vindas de props reais) nunca são marcados como demo. Não havia teste
 * fixando esse invariante antes desta rodada; sem gap de código encontrado
 * (achado do relatório T12 seção 3.3 já descrevia isso como mitigado desde
 * T7) — este teste só evita regressão futura.
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
  it("o bloco 'wishlist' (fixture local) está marcado demo: true", () => {
    expect(blockDef("wishlist")).toMatch(/demo: true/);
  });

  it("o bloco 'descobrir' (fixture local) está marcado demo: true", () => {
    expect(blockDef("descobrir")).toMatch(/demo: true/);
  });

  it("o bloco 'solicitacoes' (dado real, prop pendingRequestsCount) NÃO é demo", () => {
    expect(blockDef("solicitacoes")).not.toMatch(/demo: true/);
  });

  it("o bloco 'mensagens' (dado real, prop unreadChats) NÃO é demo", () => {
    expect(blockDef("mensagens")).not.toMatch(/demo: true/);
  });

  it("o rótulo 'Demonstração' só renderiza quando item.block.demo é truthy", () => {
    expect(src).toMatch(/\{item\.block\.demo && \(/);
    expect(src).toMatch(/Demonstração — sugestão de exemplo/);
  });
});
