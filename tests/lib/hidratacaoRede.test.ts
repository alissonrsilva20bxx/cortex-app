import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RedeTab } from "@/components/rede/RedeTab";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import * as redeCache from "@/lib/rede/redeCache";
import type { FeedPost } from "@/lib/rede/feed";

/**
 * Erro de hidratação da Rede (selo "1 error" do Next): o 1º render lia o
 * localStorage, que o servidor não tem, e o HTML saía diferente. A leitura
 * foi para um efeito depois da hidratação. Aqui o 1º render, com o
 * localStorage cheio, tem de ser idêntico ao do servidor (storage vazio).
 */

// Sem chaves reais: o cliente do Supabase é falso (o 1º render não o chama).
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const usuario = { id: "u-hidrata", nome: "Ana", email: "a@a.com" };

const post = {
  id: "p1",
  autorId: "outra",
  autorNome: "Marina TEXTO-DO-STORAGE",
  texto: "Post guardado do localStorage",
  criadoEm: "2026-10-20T10:00:00.000Z",
  fotos: [],
} as unknown as FeedPost;

function storageFalso(itens: Record<string, string>) {
  return {
    getItem: (k: string) => itens[k] ?? null,
    setItem: (k: string, v: string) => void (itens[k] = v),
    removeItem: (k: string) => void delete itens[k],
  };
}

function guardar(): Record<string, string> {
  const itens: Record<string, string> = {};
  vi.stubGlobal("localStorage", storageFalso(itens));
  vi.stubGlobal("window", { localStorage: storageFalso(itens) });
  redeCachePersist.salvar(usuario.id, { feed: [post], perfil: null });
  return itens;
}

afterEach(() => {
  vi.unstubAllGlobals();
  redeCache.vincularUsuario("outro-usuario"); // zera a memória da sessão
});

describe("RedeTab: o 1º render não lê o localStorage", () => {
  it("com o storage cheio, o HTML do 1º render é igual ao do servidor (vazio)", () => {
    const servidor = renderToString(createElement(RedeTab, { usuario }));

    const itens = guardar();
    expect(Object.keys(itens).length).toBeGreaterThan(0);
    // Garante que o dado de fato seria lido por quem pedisse.
    expect(redeCachePersist.carregar(usuario.id)?.feed.length).toBe(1);

    redeCache.vincularUsuario("outro-usuario");
    const cliente1Render = renderToString(createElement(RedeTab, { usuario }));

    expect(cliente1Render).toBe(servidor);
    expect(cliente1Render).not.toContain("TEXTO-DO-STORAGE");
  });

  it("a leitura do storage mora num efeito (layout), não no corpo do render", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "components/rede/RedeTab.tsx"),
      "utf-8"
    );
    const chamadas = src.match(/redeCachePersist\.carregar\(/g) ?? [];
    expect(chamadas.length).toBe(1);
    const antes = src.slice(0, src.indexOf("redeCachePersist.carregar("));
    expect(antes.lastIndexOf("useEfeitoDeLayout(() => {")).toBeGreaterThan(
      antes.lastIndexOf("const semente = sementeRef.current;")
    );
  });
});

describe("RedeTab: 'offline' não depende do navigator no servidor", () => {
  it("com um navigator sem onLine (Node 21+), o HTML não traz o aviso de offline", () => {
    vi.stubGlobal("navigator", {});
    const html = renderToString(createElement(RedeTab, { usuario }));
    expect(html).not.toContain("Você está offline");
  });
});
