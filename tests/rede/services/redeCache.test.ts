import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as redeCache from "../../../lib/rede/redeCache";
import type { FeedPost } from "../../../lib/rede/feed";

/**
 * Cache SWR em memória da Rede. Ambiente `node`, sem `localStorage` -- aqui
 * só o cache em memória (o persistido tem teste próprio).
 */

function post(id: string, over: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    autorId: "u1",
    autorNome: "U1",
    autorCor: "#000",
    autorFotoUrl: null,
    categoria: "geral",
    texto: `post ${id}`,
    criadoEm: `2026-09-10T00:00:${id.padStart(2, "0")}.000Z`,
    atualizadoEm: `2026-09-10T00:00:${id.padStart(2, "0")}.000Z`,
    curtidas: 0,
    curtidoPorMim: false,
    comentariosCount: 0,
    fotos: [],
    ...over,
  };
}

beforeEach(() => {
  redeCache._resetParaTeste();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("isolamento por conta", () => {
  it("ler de uma conta diferente da vinculada devolve null", () => {
    redeCache.vincularUsuario("A");
    redeCache.escreverFeed("A", [post("1")], false);
    expect(redeCache.lerFeed("A")?.posts).toHaveLength(1);
    expect(redeCache.lerFeed("B")).toBeNull();
  });

  it("vincular outra conta limpa tudo da anterior", () => {
    redeCache.vincularUsuario("A");
    redeCache.escreverFeed("A", [post("1")], false);
    redeCache.escrever("A", "perfil", { nome: "x" });

    redeCache.vincularUsuario("B");
    expect(redeCache.lerFeed("A")).toBeNull();
    expect(redeCache.lerFeed("B")).toBeNull();
    expect(redeCache.ler("A", "perfil")).toBeNull();
  });
});

describe("época / resposta em voo da conta anterior (req 4)", () => {
  it("escreverFeed com época antiga é ignorado após troca de conta", () => {
    redeCache.vincularUsuario("A");
    const epocaA = redeCache.epocaAtual();

    // conta troca no meio de um listarFeed em voo capturado com epocaA
    redeCache.vincularUsuario("B");
    redeCache.escreverFeed("B", [post("99")], false, epocaA);

    expect(redeCache.lerFeed("B")).toBeNull();
  });

  it("escrever (recurso leve) com época antiga também é ignorado", () => {
    redeCache.vincularUsuario("A");
    const epocaA = redeCache.epocaAtual();
    redeCache.vincularUsuario("B");
    redeCache.escrever("B", "amigas", { friends: [1] }, epocaA);
    expect(redeCache.ler("B", "amigas")).toBeNull();
  });

  it("escreverFeed com a época atual passa", () => {
    redeCache.vincularUsuario("A");
    redeCache.escreverFeed("A", [post("1")], true, redeCache.epocaAtual());
    expect(redeCache.lerFeed("A")?.posts).toHaveLength(1);
  });
});

describe("staleness (SWR)", () => {
  it("fresco logo após escrever, stale depois de STALE_MS", () => {
    vi.useFakeTimers();
    redeCache.vincularUsuario("A");
    redeCache.escreverFeed("A", [post("1")], false);
    expect(redeCache.lerFeed("A")?.stale).toBe(false);

    vi.advanceTimersByTime(redeCache._internos.STALE_MS + 1);
    expect(redeCache.lerFeed("A")?.stale).toBe(true);
    // ...mas o dado continua sendo servido (SWR)
    expect(redeCache.lerFeed("A")?.posts).toHaveLength(1);
  });

  it("invalidarFeed marca stale sem apagar o conteúdo", () => {
    redeCache.vincularUsuario("A");
    redeCache.escreverFeed("A", [post("1")], false);
    redeCache.invalidarFeed("A");
    expect(redeCache.lerFeed("A")?.stale).toBe(true);
    expect(redeCache.lerFeed("A")?.posts).toHaveLength(1);
  });
});

describe("tombstones -- apagado não ressuscita (req 6)", () => {
  it("marcarExcluido some com o post do feed cacheado na hora", () => {
    redeCache.vincularUsuario("A");
    redeCache.escreverFeed("A", [post("1"), post("2")], false);
    redeCache.marcarExcluido("1");
    expect(redeCache.lerFeed("A")?.posts.map((p) => p.id)).toEqual(["2"]);
  });

  it("um escreverFeed posterior (listarFeed em voo) não traz o post de volta", () => {
    redeCache.vincularUsuario("A");
    redeCache.marcarExcluido("1");
    redeCache.escreverFeed("A", [post("1"), post("2")], false);
    expect(redeCache.lerFeed("A")?.posts.map((p) => p.id)).toEqual(["2"]);
  });

  it("mutarFeed também respeita tombstone", () => {
    redeCache.vincularUsuario("A");
    redeCache.escreverFeed("A", [post("2")], false);
    redeCache.marcarExcluido("1");
    redeCache.mutarFeed("A", (ps) => [post("1"), ...ps]);
    expect(redeCache.lerFeed("A")?.posts.map((p) => p.id)).toEqual(["2"]);
  });

  it("limparTudo zera tombstones (login novo é folha limpa)", () => {
    redeCache.vincularUsuario("A");
    redeCache.marcarExcluido("1");
    redeCache.limparTudo();
    redeCache.vincularUsuario("A");
    redeCache.escreverFeed("A", [post("1")], false);
    expect(redeCache.lerFeed("A")?.posts.map((p) => p.id)).toEqual(["1"]);
  });
});

describe("reconciliarFeed", () => {
  it("mantém páginas profundas já carregadas (mais antigas que a página 1)", () => {
    // em tela: página 1 (30,25,20) + página 2 (10). refresh traz um post
    // novo (35) e continua sem enxergar o 10.
    const anteriores = [post("30"), post("25"), post("20"), post("10")];
    const frescos = [post("35"), post("30"), post("25"), post("20")];
    const out = redeCache.reconciliarFeed(anteriores, frescos, new Set(), "u1");
    expect(out.map((p) => p.id)).toEqual(["35", "30", "25", "20", "10"]);
  });

  it("preserva curtida otimista pendente contra resposta antiga (req 6)", () => {
    const anteriores = [post("1", { curtidoPorMim: true, curtidas: 5 })];
    const frescos = [post("1", { curtidoPorMim: false, curtidas: 4 })];
    const out = redeCache.reconciliarFeed(
      anteriores,
      frescos,
      new Set(["1"]),
      "u1"
    );
    expect(out[0]).toMatchObject({ curtidoPorMim: true, curtidas: 5 });
  });

  it("mantém post recém-publicado meu que a resposta em voo ainda não traz", () => {
    const novo = post("99", {
      autorId: "u1",
      criadoEm: "2026-09-11T00:00:00Z",
    });
    const anteriores = [novo, post("30")];
    const frescos = [post("30"), post("20")];
    const out = redeCache.reconciliarFeed(anteriores, frescos, new Set(), "u1");
    expect(out.map((p) => p.id)).toEqual(["99", "30", "20"]);
  });

  it("descarta post tombstoned mesmo se vier nos frescos", () => {
    redeCache.marcarExcluido("20");
    const out = redeCache.reconciliarFeed(
      [],
      [post("30"), post("20")],
      new Set(),
      "u1"
    );
    expect(out.map((p) => p.id)).toEqual(["30"]);
  });
});

describe("slide do carrossel / scroll / segmento", () => {
  it("lembra e devolve o slide por post; default 0", () => {
    expect(redeCache.slideLembrado("p1")).toBe(0);
    redeCache.lembrarSlide("p1", 1);
    expect(redeCache.slideLembrado("p1")).toBe(1);
  });

  it("scrollLembrado é null até a 1ª gravação", () => {
    expect(redeCache.scrollLembrado()).toBeNull();
    redeCache.lembrarScroll(240);
    expect(redeCache.scrollLembrado()).toBe(240);
  });

  it("limparTudo zera slide, scroll e segmento", () => {
    redeCache.lembrarSlide("p1", 1);
    redeCache.lembrarScroll(240);
    redeCache.lembrarSegmento("amigas");
    redeCache.limparTudo();
    expect(redeCache.slideLembrado("p1")).toBe(0);
    expect(redeCache.scrollLembrado()).toBeNull();
    expect(redeCache.segmentoLembrado()).toBe("paraVoce");
  });
});

describe("acesso lembrado -- apresentação só", () => {
  it("undefined até a 1ª verificação; guarda o último resultado real", () => {
    redeCache.vincularUsuario("A");
    expect(redeCache.acessoLembrado("A")).toBeUndefined();
    redeCache.lembrarAcesso("A", true);
    expect(redeCache.acessoLembrado("A")).toBe(true);
  });

  it("limparTudo / troca de conta esquece o acesso", () => {
    redeCache.vincularUsuario("A");
    redeCache.lembrarAcesso("A", true);
    redeCache.vincularUsuario("B");
    expect(redeCache.acessoLembrado("A")).toBeUndefined();
  });
});
