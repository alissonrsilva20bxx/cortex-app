import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

/**
 * O "1 error" do preview (#50): recarregar /dev-preview/app dava "Hydration
 * failed" no FeedScreen/PullToRefresh. Causa: o RedeGatedTab lia o acesso
 * guardado no localStorage (`jobapp-rede-acesso:<id>`) no 1º render. O
 * servidor não tem localStorage e desenhava "verificando"; o navegador, na
 * recarga, achava o carimbo e desenhava o Feed.
 *
 * `renderToString` faz só o 1º render, sem efeitos: é o HTML do servidor
 * (sem localStorage) e o que o navegador desenha ao hidratar (com o carimbo
 * guardado). Os dois têm de ser iguais.
 */

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
// A consulta de acesso não responde: só o 1º render importa aqui.
vi.mock("@/lib/rede/acessoRede", () => ({
  verificarAcessoRede: () => new Promise(() => {}),
}));
// O Feed de verdade não precisa ser desenhado: basta saber se apareceu.
vi.mock("@/components/rede/RedeTab", () => ({
  RedeTab: () => createElement("div", { "data-feed": "" }),
}));

import { RedeGatedTab } from "@/components/rede/RedeGatedTab";
import * as redeCache from "@/lib/rede/redeCache";
import type { Usuario } from "@/lib/types";

const usuario = { id: "u-hidrata", nome: "Teste" } as unknown as Usuario;

function guardado(chaves: Record<string, string>) {
  const m = new Map(Object.entries(chaves));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    clear: () => m.clear(),
    get length() {
      return m.size;
    },
  };
}

const desenhar = () =>
  renderToString(createElement(RedeGatedTab, { usuario, active: true }));

afterEach(() => {
  vi.unstubAllGlobals();
  redeCache.limparTudo();
});

describe("Rede: recarregar a página não dá erro de hidratação", () => {
  it("com o acesso guardado no aparelho, o 1º render do navegador é igual ao do servidor", () => {
    redeCache.limparTudo();
    const servidor = desenhar(); // sem localStorage, como no Node

    redeCache.limparTudo(); // documento novo: memória vazia
    vi.stubGlobal(
      "localStorage",
      guardado({
        [`jobapp-rede-acesso:${usuario.id}`]: JSON.stringify({
          v: 1,
          userId: usuario.id,
          unlocked: true,
          confirmadoEm: Date.now(),
        }),
      })
    );
    const navegador = desenhar();

    expect(navegador).toBe(servidor);
    expect(navegador).not.toContain("data-feed");
  });
});
