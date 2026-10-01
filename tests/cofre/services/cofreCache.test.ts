import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as cofreCache from "../../../lib/cofre/cofreCache";
import type { CofreFile } from "../../../lib/cofre/cofreCache";

/**
 * Cache SWR do Cofre. Ambiente `node`, sem `localStorage` -- os blocos
 * abaixo exercitam só a camada em memória; a camada persistida (abrir
 * instantâneo/offline) tem o próprio bloco no fim, com um localStorage em
 * memória.
 */

function file(name: string, over: Partial<CofreFile> = {}): CofreFile {
  return {
    name,
    path: `u1/documentos/${name}`,
    categoria: "documentos",
    size: 1024,
    createdAt: "2026-09-20T00:00:00.000Z",
    mimeType: "application/pdf",
    ...over,
  };
}

beforeEach(() => {
  cofreCache._resetParaTeste();
});

describe("cache miss vs hit", () => {
  it("ler antes de qualquer escrita é null (cache miss verdadeiro)", () => {
    cofreCache.vincularUsuario("u1");
    expect(cofreCache.ler("u1")).toBeNull();
  });

  it("escrever e depois ler devolve os mesmos arquivos (hit)", () => {
    cofreCache.vincularUsuario("u1");
    cofreCache.escrever("u1", [file("a.pdf")]);
    expect(cofreCache.ler("u1")).toEqual([file("a.pdf")]);
  });

  it("lista vazia escrita explicitamente ainda é um hit (não null)", () => {
    cofreCache.vincularUsuario("u1");
    cofreCache.escrever("u1", []);
    expect(cofreCache.ler("u1")).toEqual([]);
  });
});

describe("isolamento por conta", () => {
  it("ler de uma conta diferente da vinculada devolve null", () => {
    cofreCache.vincularUsuario("A");
    cofreCache.escrever("A", [file("a.pdf")]);
    expect(cofreCache.ler("A")).toHaveLength(1);
    expect(cofreCache.ler("B")).toBeNull();
  });

  it("vincular outra conta limpa o cache da anterior", () => {
    cofreCache.vincularUsuario("A");
    cofreCache.escrever("A", [file("a.pdf")]);

    cofreCache.vincularUsuario("B");
    expect(cofreCache.ler("A")).toBeNull();
    expect(cofreCache.ler("B")).toBeNull();
  });

  it("respostas atrasadas de uma conta anterior não contaminam a nova conta", () => {
    cofreCache.vincularUsuario("A");
    const epocaA = cofreCache.epocaAtual();

    // troca de conta no meio de um fetch em voo capturado com epocaA
    cofreCache.vincularUsuario("B");
    cofreCache.escrever("B", [file("atrasado.pdf")], epocaA);

    expect(cofreCache.ler("B")).toBeNull();
  });

  it("escrever com a época atual passa normalmente", () => {
    cofreCache.vincularUsuario("A");
    cofreCache.escrever("A", [file("a.pdf")], cofreCache.epocaAtual());
    expect(cofreCache.ler("A")).toHaveLength(1);
  });
});

describe("logout limpa o cache (req 4/6)", () => {
  it("limparTudo zera o cache e avança a época", () => {
    cofreCache.vincularUsuario("A");
    cofreCache.escrever("A", [file("a.pdf")]);
    const epocaAntes = cofreCache.epocaAtual();

    cofreCache.limparTudo();

    expect(cofreCache.ler("A")).toBeNull();
    expect(cofreCache.epocaAtual()).toBeGreaterThan(epocaAntes);
  });

  it("uma escrita em voo capturada antes do limparTudo é descartada", () => {
    cofreCache.vincularUsuario("A");
    const ep = cofreCache.epocaAtual();
    cofreCache.limparTudo();
    cofreCache.vincularUsuario("A"); // mesma conta loga de novo
    cofreCache.escrever("A", [file("velho.pdf")], ep);
    expect(cofreCache.ler("A")).toBeNull();
  });
});

describe("upload/revalidação atualiza a lista (req)", () => {
  it("um novo `escrever` substitui a lista cacheada inteira (revalidação após upload)", () => {
    cofreCache.vincularUsuario("A");
    cofreCache.escrever("A", [file("a.pdf")]);
    cofreCache.escrever("A", [file("a.pdf"), file("b.pdf")]);
    expect(cofreCache.ler("A")?.map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
  });
});

describe("nenhum signed URL entra no cache", () => {
  it("CofreFile não tem campo de signed URL -- estruturalmente impossível cachear um", () => {
    cofreCache.vincularUsuario("A");
    const f = file("a.pdf");
    cofreCache.escrever("A", [f]);
    const lido = cofreCache.ler("A")?.[0];
    expect(lido).not.toHaveProperty("signedUrl");
    expect(lido).not.toHaveProperty("url");
    expect(Object.keys(lido ?? {}).sort()).toEqual(
      ["categoria", "createdAt", "mimeType", "name", "path", "size"].sort()
    );
  });
});

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

describe("camada persistida (reabrir o PWA / offline)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /** Módulo novo = documento novo (reload, iOS descartou o PWA). */
  async function moduloNovo() {
    vi.resetModules();
    return import("../../../lib/cofre/cofreCache");
  }

  it("lista escrita sobrevive a um documento novo (hit sem rede)", async () => {
    const a = await moduloNovo();
    a.vincularUsuario("u1");
    a.escrever("u1", [file("a.pdf")]);

    const b = await moduloNovo();
    b.vincularUsuario("u1");
    expect(b.ler("u1")).toEqual([file("a.pdf")]);
  });

  it("documento novo de outra conta não enxerga a lista da anterior", async () => {
    const a = await moduloNovo();
    a.vincularUsuario("u1");
    a.escrever("u1", [file("a.pdf")]);

    const b = await moduloNovo();
    b.vincularUsuario("u2");
    expect(b.ler("u2")).toBeNull();
  });

  it("logout apaga o disco também", async () => {
    const a = await moduloNovo();
    a.vincularUsuario("u1");
    a.escrever("u1", [file("a.pdf")]);
    a.limparTudo();

    const b = await moduloNovo();
    b.vincularUsuario("u1");
    expect(b.ler("u1")).toBeNull();
  });

  it("JSON corrompido ou de outra versão vira cache miss, sem lançar", async () => {
    localStorage.setItem("jobapp-cofre-cache:u1", "{nao-e-json");
    localStorage.setItem(
      "jobapp-cofre-cache:u2",
      JSON.stringify({ v: 999, userId: "u2", ts: 1, files: [] })
    );
    const b = await moduloNovo();
    b.vincularUsuario("u1");
    expect(b.ler("u1")).toBeNull();
    const c = await moduloNovo();
    c.vincularUsuario("u2");
    expect(c.ler("u2")).toBeNull();
  });

  it("só metadados vão pro disco (nenhuma URL)", async () => {
    const a = await moduloNovo();
    a.vincularUsuario("u1");
    a.escrever("u1", [
      { ...file("a.pdf"), signedUrl: "https://x" } as unknown as CofreFile,
    ]);
    const raw = localStorage.getItem("jobapp-cofre-cache:u1") ?? "";
    expect(raw).not.toContain("https://x");
  });
});
