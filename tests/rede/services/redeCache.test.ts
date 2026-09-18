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

describe("acesso lembrado -- apresentação só, com validade curta", () => {
  it("undefined até a 1ª confirmação; guarda unlocked + carimbo de tempo", () => {
    redeCache.vincularUsuario("A");
    expect(redeCache.acessoLembrado("A")).toBeUndefined();
    redeCache.lembrarAcesso("A", true);
    const lembrado = redeCache.acessoLembrado("A");
    expect(lembrado?.unlocked).toBe(true);
    expect(typeof lembrado?.confirmadoEm).toBe("number");
  });

  it("acessoConfirmadoValido: true logo após confirmar, false depois do teto", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      redeCache.vincularUsuario("A");
      expect(redeCache.acessoConfirmadoValido("A")).toBe(false);
      redeCache.lembrarAcesso("A", true);
      expect(redeCache.acessoConfirmadoValido("A")).toBe(true);

      vi.advanceTimersByTime(redeCache._internos.ACESSO_CONFIRMADO_TTL_MS + 1);
      expect(redeCache.acessoConfirmadoValido("A")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  // Regressão literal do bug relatado (T121, reteste real no iPhone):
  // confirmação 91992ms antes do desbloqueio (~92s) derrubava o conteúdo
  // com o TTL antigo de 90s. O teto agora é 24h -- 92s precisa continuar
  // válido por uma folga enorme, não só passar raspando.
  it("92s desde a confirmação continua válido (regressão do TTL de 90s)", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      redeCache.vincularUsuario("A");
      redeCache.lembrarAcesso("A", true);
      vi.advanceTimersByTime(92_000);
      expect(redeCache.acessoConfirmadoValido("A")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("teto é exatamente 24h: válido a 1ms de completar, inválido a 1ms de passar", () => {
    const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
    expect(redeCache._internos.ACESSO_CONFIRMADO_TTL_MS).toBe(
      VINTE_QUATRO_HORAS_MS
    );
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      redeCache.vincularUsuario("A");
      redeCache.lembrarAcesso("A", true);

      vi.advanceTimersByTime(VINTE_QUATRO_HORAS_MS - 1);
      expect(redeCache.acessoConfirmadoValido("A")).toBe(true);

      vi.advanceTimersByTime(2); // agora VINTE_QUATRO_HORAS_MS + 1 desde a confirmação
      expect(redeCache.acessoConfirmadoValido("A")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tempoRestanteAteTeto: null sem carimbo, decresce com o tempo, pode passar de 0", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      redeCache.vincularUsuario("A");
      expect(redeCache.tempoRestanteAteTeto("A")).toBeNull();

      redeCache.lembrarAcesso("A", true);
      expect(redeCache.tempoRestanteAteTeto("A")).toBe(
        redeCache._internos.ACESSO_CONFIRMADO_TTL_MS
      );

      vi.advanceTimersByTime(92_000);
      expect(redeCache.tempoRestanteAteTeto("A")).toBe(
        redeCache._internos.ACESSO_CONFIRMADO_TTL_MS - 92_000
      );

      vi.advanceTimersByTime(redeCache._internos.ACESSO_CONFIRMADO_TTL_MS);
      expect(redeCache.tempoRestanteAteTeto("A")).toBeLessThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("offline (nenhuma chamada a lembrarAcesso) nunca estende o prazo -- só resposta positiva grava carimbo", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      redeCache.vincularUsuario("A");
      redeCache.lembrarAcesso("A", true);
      const carimboOriginal = redeCache.acessoLembrado("A")?.confirmadoEm;

      // Simula o tempo passando com só leituras (sem nenhuma nova
      // confirmação positiva) -- ler não é o mesmo que confirmar.
      vi.advanceTimersByTime(1000);
      redeCache.acessoConfirmadoValido("A");
      redeCache.acessoLembrado("A");
      vi.advanceTimersByTime(1000);
      redeCache.acessoConfirmadoValido("A");

      expect(redeCache.acessoLembrado("A")?.confirmadoEm).toBe(carimboOriginal);
    } finally {
      vi.useRealTimers();
    }
  });

  it("limparTudo / troca de conta esquece o acesso (revogação e troca de conta)", () => {
    redeCache.vincularUsuario("A");
    redeCache.lembrarAcesso("A", true);
    expect(redeCache.acessoConfirmadoValido("A")).toBe(true);

    // Revogação (logout/negado): limparTudo zera a conta atual.
    redeCache.limparTudo();
    expect(redeCache.acessoLembrado("A")).toBeUndefined();
    expect(redeCache.acessoConfirmadoValido("A")).toBe(false);

    // Reconfirma e troca de conta: a nova conta não herda nada da anterior.
    redeCache.lembrarAcesso("A", true);
    redeCache.vincularUsuario("B");
    expect(redeCache.acessoLembrado("A")).toBeUndefined();
    expect(redeCache.acessoConfirmadoValido("B")).toBe(false);
  });

  it("lembrarAcesso aceita um confirmadoEm explícito (pra concordar com o carimbo persistido)", () => {
    redeCache.vincularUsuario("A");
    redeCache.lembrarAcesso("A", true, 555);
    expect(redeCache.acessoLembrado("A")?.confirmadoEm).toBe(555);
  });
});

describe("hidratarAcesso -- repõe o carimbo persistido num documento novo", () => {
  it("semeia a memória vazia com o carimbo persistido", () => {
    redeCache.vincularUsuario("A");
    expect(redeCache.acessoLembrado("A")).toBeUndefined();
    redeCache.hidratarAcesso("A", { unlocked: true, confirmadoEm: 999 });
    expect(redeCache.acessoLembrado("A")).toEqual({
      unlocked: true,
      confirmadoEm: 999,
    });
  });

  it("nulo (nada persistido) é no-op", () => {
    redeCache.vincularUsuario("A");
    redeCache.hidratarAcesso("A", null);
    expect(redeCache.acessoLembrado("A")).toBeUndefined();
  });

  it("NÃO sobrescreve um resultado já obtido nesta sessão de JS", () => {
    redeCache.vincularUsuario("A");
    redeCache.lembrarAcesso("A", true, 1000);
    redeCache.hidratarAcesso("A", { unlocked: false, confirmadoEm: 2000 });
    expect(redeCache.acessoLembrado("A")?.confirmadoEm).toBe(1000);
  });

  it("não estende o TTL -- um carimbo hidratado velho ainda é inválido", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      redeCache.vincularUsuario("A");
      redeCache.hidratarAcesso("A", {
        unlocked: true,
        confirmadoEm:
          1_000_000 - redeCache._internos.ACESSO_CONFIRMADO_TTL_MS - 1,
      });
      expect(redeCache.acessoConfirmadoValido("A")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
