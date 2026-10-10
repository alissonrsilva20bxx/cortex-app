import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ABAS_FEED,
  contarNovasDasAmigas,
  dicasDaSemana,
  ehAbaFeed,
  gravarVisitaAmigas,
  lerUltimaVisitaAmigas,
  postsDasAmigas,
  separarNovas,
} from "@/lib/rede/abasFeed";
import type { FeedPost } from "@/lib/rede/feed";

/** As 3 abas do feed (proposta "Três abas"). A lógica roda de verdade. */

const agora = new Date("2026-09-23T10:00:00Z");
const horasAtras = (h: number) =>
  new Date(agora.getTime() - h * 3_600_000).toISOString();

const post = (
  id: string,
  autorId: string,
  h: number,
  extra: Partial<FeedPost> = {}
): FeedPost => ({
  id,
  autorId,
  autorNome: autorId,
  autorCor: "#000",
  autorFotoUrl: null,
  categoria: "geral",
  texto: id,
  criadoEm: horasAtras(h),
  atualizadoEm: horasAtras(h),
  curtidas: 0,
  curtidoPorMim: false,
  comentariosCount: 0,
  fotos: [],
  ...extra,
});

const EU = "eu";
const AMIGAS = ["ana", "bia"];
const POSTS = [
  post("p1", "ana", 2),
  post("p2", EU, 5),
  post("p3", "estranha", 6),
  post("p4", "bia", 30),
  post("p5", "ana", 50),
];

describe("as abas", () => {
  it("Para você, Amigas e Descobrir, nesta ordem", () => {
    expect(ABAS_FEED.map((a) => a.rotulo)).toEqual([
      "Para você",
      "Amigas",
      "Descobrir",
    ]);
    expect(ABAS_FEED.map((a) => a.id)).toEqual([
      "paraVoce",
      "amigas",
      "descobrir",
    ]);
  });

  it("ehAbaFeed reconhece só as 3", () => {
    expect(ehAbaFeed("descobrir")).toBe(true);
    expect(ehAbaFeed("stories")).toBe(false);
  });
});

describe("Amigas", () => {
  it("só as amigas e você, na ordem do feed", () => {
    expect(postsDasAmigas(POSTS, AMIGAS, EU).map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p4",
      "p5",
    ]);
  });

  it("separa novas (depois da última visita) e já vistas", () => {
    const r = separarNovas(postsDasAmigas(POSTS, AMIGAS, EU), horasAtras(20));
    expect(r.dividir).toBe(true);
    expect(r.novas.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(r.vistas.map((p) => p.id)).toEqual(["p4", "p5"]);
  });

  it("1ª visita (sem corte): tudo junto, sem divisão", () => {
    const r = separarNovas(POSTS, null);
    expect(r.dividir).toBe(false);
    expect(r.novas).toHaveLength(POSTS.length);
    expect(r.vistas).toHaveLength(0);
  });

  it("o número da aba conta só as das amigas depois da visita (não as suas)", () => {
    expect(contarNovasDasAmigas(POSTS, AMIGAS, horasAtras(20))).toBe(1);
    expect(contarNovasDasAmigas(POSTS, AMIGAS, horasAtras(60))).toBe(3);
  });

  it("sem visita registrada, nenhum número", () => {
    expect(contarNovasDasAmigas(POSTS, AMIGAS, null)).toBe(0);
  });
});

describe("Descobrir: dicas da semana", () => {
  const dicas = [
    post("d1", "ana", 10, { categoria: "dica", curtidas: 2 }),
    post("d2", "bia", 20, { categoria: "dica", curtidas: 9 }),
    post("d3", "x", 30, { categoria: "dica", curtidas: 9 }),
    post("d4", "x", 24 * 8, { categoria: "dica", curtidas: 99 }),
    post("g1", "x", 5, { categoria: "geral", curtidas: 50 }),
  ];

  it("só dicas dos últimos 7 dias, das mais curtidas; empate, a mais nova", () => {
    expect(dicasDaSemana(dicas, agora).map((p) => p.id)).toEqual([
      "d2",
      "d3",
      "d1",
    ]);
  });
});

describe("última visita à aba Amigas (localStorage)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("grava e lê por usuária", () => {
    const mapa = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mapa.get(k) ?? null,
      setItem: (k: string, v: string) => void mapa.set(k, v),
    });
    expect(lerUltimaVisitaAmigas("u1")).toBeNull();
    gravarVisitaAmigas("u1", agora);
    expect(lerUltimaVisitaAmigas("u1")).toBe(agora.toISOString());
    expect(lerUltimaVisitaAmigas("u2")).toBeNull();
    expect([...mapa.keys()]).toEqual(["rede:amigas-visita:u1"]);
  });

  it("storage quebrado ou valor inválido: null, sem lançar", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerUltimaVisitaAmigas("u1")).toBeNull();
    expect(() => gravarVisitaAmigas("u1", agora)).not.toThrow();
    vi.stubGlobal("localStorage", { getItem: () => "lixo", setItem: () => {} });
    expect(lerUltimaVisitaAmigas("u1")).toBeNull();
  });
});
