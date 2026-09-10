import { afterEach, describe, expect, it, vi } from "vitest";

import * as persist from "../../../lib/rede/redeCachePersist";
import type { FeedPost } from "../../../lib/rede/feed";

/**
 * Camada persistida do cache da Rede (`localStorage`). Ambiente `node` sem
 * `localStorage` -- injeta um fake, inclusive um que LANÇA na escrita
 * (cota) pra provar que degrada em silêncio.
 */

type Modo = "ok" | "lancaSet";

function fakeLocalStorage(modo: Modo = "ok") {
  const mapa = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (mapa.has(k) ? mapa.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (modo === "lancaSet") throw new Error("QuotaExceededError");
      mapa.set(k, v);
    },
    removeItem: (k: string) => mapa.delete(k),
    key: (i: number) => Array.from(mapa.keys())[i] ?? null,
    get length() {
      return mapa.size;
    },
    _mapa: mapa,
  };
  return ls;
}

function injeta(ls: unknown) {
  // @ts-expect-error inject
  globalThis.localStorage = ls;
}

function foto(over: Partial<FeedPost["fotos"][number]> = {}) {
  return {
    ordem: 1,
    thumbUrl: "https://signed.example/thumb?token=abc",
    url: "https://signed.example/full?token=def",
    thumbPath: "u/p/1-thumb-800x600.jpg",
    path: "u/p/1.jpg",
    largura: 800,
    altura: 600,
    ...over,
  };
}

function post(id: string, over: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    autorId: "u1",
    autorNome: "U1",
    autorCor: "#000",
    autorFotoUrl: "https://public.example/avatares/u1.jpg",
    categoria: "geral",
    texto: `post ${id}`,
    criadoEm: "2026-09-10T00:00:00.000Z",
    atualizadoEm: "2026-09-10T00:00:00.000Z",
    curtidas: 2,
    curtidoPorMim: true,
    comentariosCount: 1,
    fotos: [],
    ...over,
  };
}

const perfil = {
  user_id: "u1",
  nome_exibicao: "Miguel",
  cor_avatar: "#8b5cf6",
  bio: null,
  avatar_url: "https://public.example/avatares/u1.jpg",
  area_atuacao: null,
  criado_em: "2026-09-01T00:00:00.000Z",
  atualizado_em: "2026-09-09T00:00:00.000Z",
};

afterEach(() => {
  // @ts-expect-error limpa o global
  delete globalThis.localStorage;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("salvar / carregar round-trip", () => {
  it("persiste e relê feed + perfil pela chave por usuário", () => {
    const ls = fakeLocalStorage();
    injeta(ls);

    persist.salvar("u1", { feed: [post("1"), post("2")], perfil });
    expect(ls._mapa.has(`${persist._internos.PREFIXO}u1`)).toBe(true);

    const lido = persist.carregar("u1");
    expect(lido?.feed.map((p) => p.id)).toEqual(["1", "2"]);
    expect(lido?.feed[0].curtidoPorMim).toBe(true);
    expect(lido?.perfil?.nome_exibicao).toBe("Miguel");
  });

  it("NÃO persiste as URLs assinadas das fotos; devolve strings vazias (req 5)", () => {
    const ls = fakeLocalStorage();
    injeta(ls);

    persist.salvar("u1", { feed: [post("1", { fotos: [foto()] })], perfil });

    const cru = ls._mapa.get(`${persist._internos.PREFIXO}u1`)!;
    expect(cru).not.toContain("token=abc");
    expect(cru).not.toContain("token=def");
    expect(cru).toContain("1-thumb-800x600.jpg"); // path sobrevive

    const f = persist.carregar("u1")!.feed[0].fotos[0];
    expect(f.url).toBe("");
    expect(f.thumbUrl).toBe("");
    expect(f.path).toBe("u/p/1.jpg");
    expect(f.largura).toBe(800);
  });

  it("o avatar_url (URL pública) É persistido", () => {
    const ls = fakeLocalStorage();
    injeta(ls);
    persist.salvar("u1", { feed: [post("1")], perfil });
    expect(persist.carregar("u1")?.perfil?.avatar_url).toBe(
      "https://public.example/avatares/u1.jpg"
    );
  });
});

describe("isolamento e invalidação", () => {
  it("carregar com userId diferente do gravado devolve null e limpa a chave", () => {
    const ls = fakeLocalStorage();
    injeta(ls);
    // grava algo manualmente com userId errado dentro do payload
    ls._mapa.set(
      `${persist._internos.PREFIXO}u1`,
      JSON.stringify({
        v: persist._internos.VERSAO,
        userId: "OUTRO",
        ts: Date.now(),
        feed: [],
        perfil: null,
      })
    );
    expect(persist.carregar("u1")).toBeNull();
    expect(ls._mapa.has(`${persist._internos.PREFIXO}u1`)).toBe(false);
  });

  it("versão diferente => descarta", () => {
    const ls = fakeLocalStorage();
    injeta(ls);
    ls._mapa.set(
      `${persist._internos.PREFIXO}u1`,
      JSON.stringify({
        v: persist._internos.VERSAO + 1,
        userId: "u1",
        ts: Date.now(),
        feed: [post("1")],
        perfil: null,
      })
    );
    expect(persist.carregar("u1")).toBeNull();
    expect(ls._mapa.size).toBe(0);
  });

  it("TTL vencido (>24h) => descarta", () => {
    vi.useFakeTimers();
    const ls = fakeLocalStorage();
    injeta(ls);
    persist.salvar("u1", { feed: [post("1")], perfil });
    vi.advanceTimersByTime(persist._internos.TTL_MS + 1);
    expect(persist.carregar("u1")).toBeNull();
  });

  it("JSON corrompido => trata como vazio e limpa", () => {
    const ls = fakeLocalStorage();
    injeta(ls);
    ls._mapa.set(`${persist._internos.PREFIXO}u1`, "{ não é json ]");
    expect(persist.carregar("u1")).toBeNull();
    expect(ls._mapa.size).toBe(0);
  });

  it("limpar(userId) remove só a chave daquele usuário", () => {
    const ls = fakeLocalStorage();
    injeta(ls);
    persist.salvar("u1", { feed: [post("1")], perfil });
    persist.salvar("u2", { feed: [post("2")], perfil });
    persist.limpar("u1");
    expect(persist.carregar("u1")).toBeNull();
    expect(persist.carregar("u2")?.feed).toHaveLength(1);
  });

  it("limpar() sem argumento varre todas as chaves rede-cache (logout)", () => {
    const ls = fakeLocalStorage();
    injeta(ls);
    persist.salvar("u1", { feed: [post("1")], perfil });
    persist.salvar("u2", { feed: [post("2")], perfil });
    ls._mapa.set("jobapp-outra-coisa", "preservar");
    persist.limpar();
    expect(persist.carregar("u1")).toBeNull();
    expect(persist.carregar("u2")).toBeNull();
    expect(ls._mapa.get("jobapp-outra-coisa")).toBe("preservar");
  });
});

describe("limites e degradação", () => {
  it("guarda no máximo a 1ª página (MAX_POSTS)", () => {
    const ls = fakeLocalStorage();
    injeta(ls);
    const muitos = Array.from(
      { length: persist._internos.MAX_POSTS + 5 },
      (_, i) => post(String(i))
    );
    persist.salvar("u1", { feed: muitos, perfil });
    expect(persist.carregar("u1")?.feed).toHaveLength(
      persist._internos.MAX_POSTS
    );
  });

  it("payload acima do teto de bytes: corta posts até caber", () => {
    const ls = fakeLocalStorage();
    injeta(ls);
    const gordo = "x".repeat(80 * 1024);
    const feed = Array.from({ length: persist._internos.MAX_POSTS }, (_, i) =>
      post(String(i), { texto: gordo })
    );
    persist.salvar("u1", { feed, perfil });
    const lido = persist.carregar("u1");
    expect(lido).not.toBeNull();
    expect(lido!.feed.length).toBeLessThan(persist._internos.MAX_POSTS);
  });

  it("setItem que lança (cota): não propaga e limpa a chave", () => {
    const ls = fakeLocalStorage("lancaSet");
    injeta(ls);
    expect(() =>
      persist.salvar("u1", { feed: [post("1")], perfil })
    ).not.toThrow();
    expect(ls._mapa.size).toBe(0);
  });

  it("sem localStorage (SSR): carregar=null, salvar=no-op, sem lançar", () => {
    expect(() =>
      persist.salvar("u1", { feed: [post("1")], perfil })
    ).not.toThrow();
    expect(persist.carregar("u1")).toBeNull();
    expect(() => persist.limpar()).not.toThrow();
  });
});
