import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _internos,
  lembrarProporcao,
  proporcaoLembrada,
} from "../../../lib/rede/fotoRatioMemoria";

/**
 * Memória local das proporções das fotos LEGADAS do feed. O ambiente de
 * teste é `node` (sem `localStorage`), então injetamos um fake -- inclusive
 * um que LANÇA, pra provar que nada disso quebra o feed.
 */

type Modo = "ok" | "lanca";

function fakeLocalStorage(modo: Modo = "ok") {
  const mapa = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => {
      if (modo === "lanca") throw new Error("storage indisponível");
      return mapa.has(k) ? mapa.get(k)! : null;
    }),
    setItem: vi.fn((k: string, v: string) => {
      if (modo === "lanca") throw new Error("QuotaExceededError");
      mapa.set(k, v);
    }),
    removeItem: vi.fn((k: string) => mapa.delete(k)),
    _mapa: mapa,
  };
}

const CHAVE = _internos.CHAVE;

afterEach(() => {
  // @ts-expect-error -- limpa o global entre os testes
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

describe("fotoRatioMemoria", () => {
  it("grava e relê a proporção pela chave (thumbPath)", () => {
    const ls = fakeLocalStorage();
    // @ts-expect-error inject
    globalThis.localStorage = ls;

    expect(proporcaoLembrada("u/p/1-thumb.jpg")).toBeNull();
    lembrarProporcao("u/p/1-thumb.jpg", 0.75);
    lembrarProporcao("u/p/2-thumb.jpg", 1.91);

    expect(proporcaoLembrada("u/p/1-thumb.jpg")).toBe(0.75);
    expect(proporcaoLembrada("u/p/2-thumb.jpg")).toBe(1.91);
    expect(proporcaoLembrada("u/p/3-thumb.jpg")).toBeNull();
  });

  it("atualiza a entrada existente (move pro fim) sem duplicar", () => {
    const ls = fakeLocalStorage();
    // @ts-expect-error inject
    globalThis.localStorage = ls;

    lembrarProporcao("a", 1);
    lembrarProporcao("a", 0.8);

    const guardado = JSON.parse(ls._mapa.get(CHAVE)!);
    expect(guardado).toEqual([["a", 0.8]]);
    expect(proporcaoLembrada("a")).toBe(0.8);
  });

  it("respeita o teto de entradas, descartando as mais antigas", () => {
    const ls = fakeLocalStorage();
    // @ts-expect-error inject
    globalThis.localStorage = ls;

    const total = _internos.LIMITE + 10;
    for (let i = 0; i < total; i++) lembrarProporcao(`foto-${i}`, 1 + i / 1000);

    const guardado = JSON.parse(ls._mapa.get(CHAVE)!) as [string, number][];
    expect(guardado.length).toBe(_internos.LIMITE);
    // as 10 primeiras sumiram; as últimas continuam
    expect(proporcaoLembrada("foto-0")).toBeNull();
    expect(proporcaoLembrada("foto-9")).toBeNull();
    expect(proporcaoLembrada("foto-10")).not.toBeNull();
    expect(proporcaoLembrada(`foto-${total - 1}`)).not.toBeNull();
  });

  it("sem localStorage (SSR): lê null e gravar é no-op, sem lançar", () => {
    // nenhum global.localStorage definido
    expect(() => lembrarProporcao("x", 1)).not.toThrow();
    expect(proporcaoLembrada("x")).toBeNull();
  });

  it("localStorage que LANÇA (aba anônima / cota): degrada em silêncio", () => {
    const ls = fakeLocalStorage("lanca");
    // @ts-expect-error inject
    globalThis.localStorage = ls;

    expect(() => lembrarProporcao("x", 0.75)).not.toThrow();
    expect(proporcaoLembrada("x")).toBeNull();
  });

  it("JSON corrompido no storage: trata como vazio", () => {
    const ls = fakeLocalStorage();
    ls._mapa.set(CHAVE, "{ nao e json valido ]");
    // @ts-expect-error inject
    globalThis.localStorage = ls;

    expect(proporcaoLembrada("qualquer")).toBeNull();
    // e um gravar novo consegue reescrever por cima
    lembrarProporcao("nova", 1.2);
    expect(proporcaoLembrada("nova")).toBe(1.2);
  });

  it("ignora entradas mal-formadas e valores não-positivos", () => {
    const ls = fakeLocalStorage();
    ls._mapa.set(
      CHAVE,
      JSON.stringify([["boa", 0.9], ["ruim"], ["neg", -1], ["nan", "x"]])
    );
    // @ts-expect-error inject
    globalThis.localStorage = ls;

    expect(proporcaoLembrada("boa")).toBe(0.9);
    expect(proporcaoLembrada("ruim")).toBeNull();
    expect(proporcaoLembrada("neg")).toBeNull();

    lembrarProporcao("nan", 0); // valor inválido -> não grava
    expect(proporcaoLembrada("nan")).toBeNull();
  });
});
