import { beforeEach, describe, expect, it } from "vitest";

import * as cofreCache from "../../../lib/cofre/cofreCache";
import type { CofreFile } from "../../../lib/cofre/cofreCache";

/**
 * Cache SWR em memória do Cofre. Ambiente `node`, sem `localStorage` -- este
 * módulo é deliberadamente memory-only (ver cabeçalho de
 * `lib/cofre/cofreCache.ts`), nada aqui deveria tocar disco.
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
