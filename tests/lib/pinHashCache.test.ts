import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as pinHashCache from "../../lib/pinHashCache";

/** localStorage mínimo em memória -- o ambiente do vitest é `node`. */
function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe("sem localStorage (SSR)", () => {
  it("ler devolve undefined e gravar/limpar não lançam", () => {
    expect(pinHashCache.ler("u1")).toBeUndefined();
    expect(() => pinHashCache.gravar("u1", "hash")).not.toThrow();
    expect(() => pinHashCache.limparTudo()).not.toThrow();
  });
});

describe("com localStorage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("nada guardado = undefined (offline não pode abrir)", () => {
    expect(pinHashCache.ler("u1")).toBeUndefined();
  });

  it("conta sem PIN é guardada como null, não como ausência", () => {
    pinHashCache.gravar("u1", null);
    expect(pinHashCache.ler("u1")).toBeNull();
  });

  it("guarda o hash por conta", () => {
    pinHashCache.gravar("u1", "abc");
    pinHashCache.gravar("u2", "xyz");
    expect(pinHashCache.ler("u1")).toBe("abc");
    expect(pinHashCache.ler("u2")).toBe("xyz");
  });

  it("logout apaga todas as contas e nada mais", () => {
    pinHashCache.gravar("u1", "abc");
    pinHashCache.gravar("u2", null);
    localStorage.setItem("jobapp-theme", "gold");
    pinHashCache.limparTudo();
    expect(pinHashCache.ler("u1")).toBeUndefined();
    expect(pinHashCache.ler("u2")).toBeUndefined();
    expect(localStorage.getItem("jobapp-theme")).toBe("gold");
  });

  it("storage que lança degrada pra 'nada guardado'", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    });
    expect(pinHashCache.ler("u1")).toBeUndefined();
    expect(() => pinHashCache.gravar("u1", "abc")).not.toThrow();
  });
});
