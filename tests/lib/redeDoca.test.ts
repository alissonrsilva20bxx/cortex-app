import { describe, expect, it } from "vitest";
import {
  contarNovasDasAmigas,
  dicasDaSemana,
  postsDasAmigas,
  separarNovas,
} from "@/lib/rede/abasFeed";
import { alturaDoLeque } from "@/lib/rede/leque";
import {
  PUSH_MENSAGEM_CORPO,
  PUSH_MENSAGEM_TITULO,
} from "@/lib/rede/pushMensagem";
import type { FeedPost } from "@/lib/rede/feed";

/**
 * Lógica do modelo Doca da Rede (protótipo aprovado
 * .lavish/rede-doca-final.html), rodando de verdade:
 *  - a pílula "N novas" da aba Amigas (FeedScreen: contarNovasDasAmigas com
 *    o corte da visita anterior, só das amigas);
 *  - "O melhor da semana" do Descobrir (dicasDaSemana, sem tabela nova);
 *  - a altura do leque do par de fotos;
 *  - o texto neutro do push de mensagem.
 */

const agora = new Date("2026-10-20T12:00:00Z");
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

describe('pílula "N novas" (aba Amigas)', () => {
  const eu = "eu";
  const amigas = ["ana", "bia"];
  const posts = [
    post("meu-novo", eu, 1),
    post("ana-nova", "ana", 2),
    post("bia-nova", "bia", 3),
    post("estranha-nova", "zé", 1),
    post("ana-velha", "ana", 30),
  ];
  const corte = horasAtras(10);

  it("conta só as das amigas publicadas depois da visita anterior", () => {
    const daAmigas = postsDasAmigas(posts, amigas, eu);
    // as minhas entram na lista, mas não são "novas" para mim
    expect(daAmigas.map((p) => p.id)).toContain("meu-novo");
    expect(contarNovasDasAmigas(daAmigas, amigas, corte)).toBe(2);
  });

  it("quem não é amiga não conta, nem publicada agora", () => {
    expect(contarNovasDasAmigas(posts, amigas, corte)).toBe(2);
  });

  it("sem visita anterior (1ª vez na aba) não há pílula", () => {
    const daAmigas = postsDasAmigas(posts, amigas, eu);
    expect(contarNovasDasAmigas(daAmigas, amigas, null)).toBe(0);
    expect(separarNovas(daAmigas, null).dividir).toBe(false);
  });

  it('a pílula leva ao divisor: "novas" são as do corte para frente', () => {
    const daAmigas = postsDasAmigas(posts, amigas, eu);
    const { novas, vistas } = separarNovas(daAmigas, corte);
    expect(novas.map((p) => p.id)).toEqual([
      "meu-novo",
      "ana-nova",
      "bia-nova",
    ]);
    expect(vistas.map((p) => p.id)).toEqual(["ana-velha"]);
  });
});

describe('Descobrir: "O melhor da semana"', () => {
  const posts = [
    post("dica-30", "a", 20, { categoria: "dica", curtidas: 30 }),
    post("dica-90-velha", "b", 24 * 9, { categoria: "dica", curtidas: 90 }),
    post("conquista-99", "c", 5, { categoria: "conquista", curtidas: 99 }),
    post("dica-40", "d", 50, { categoria: "dica", curtidas: 40 }),
    post("dica-30-nova", "e", 2, { categoria: "dica", curtidas: 30 }),
    post("dica-limite", "f", 24 * 7 - 1, { categoria: "dica", curtidas: 1 }),
  ];

  it("só dicas dos últimos 7 dias, das mais curtidas; empate, a mais nova antes", () => {
    expect(dicasDaSemana(posts, agora).map((p) => p.id)).toEqual([
      "dica-40",
      "dica-30-nova",
      "dica-30",
      "dica-limite",
    ]);
  });

  it("dica de 9 dias atrás e outras categorias ficam de fora", () => {
    const ids = dicasDaSemana(posts, agora).map((p) => p.id);
    expect(ids).not.toContain("dica-90-velha");
    expect(ids).not.toContain("conquista-99");
  });

  it("semana sem dica: lista vazia (a tela mostra o aviso)", () => {
    expect(dicasDaSemana([post("x", "a", 1)], agora)).toEqual([]);
  });
});

describe("leque do par de fotos", () => {
  it("aberto é mais baixo que fechado (as duas lado a lado, sem giro)", () => {
    expect(alturaDoLeque(338, true)).toBeLessThan(alturaDoLeque(338, false));
  });

  it("cresce com a largura do cartão (390 e 430 de tela)", () => {
    expect(alturaDoLeque(378, false)).toBeGreaterThan(
      alturaDoLeque(338, false)
    );
    expect(alturaDoLeque(338, false)).toBe(Math.round(338 * 0.58 * 1.25 + 46));
    expect(alturaDoLeque(338, true)).toBe(Math.round(338 * 0.49 * 1.25 + 46));
  });

  it("antes de medir, um valor seguro", () => {
    expect(alturaDoLeque(0, false)).toBe(290);
    expect(alturaDoLeque(0, true)).toBe(254);
  });
});

describe("push de mensagem neutro", () => {
  it('título "Nova mensagem" e corpo genérico, sem nome nem trecho', () => {
    expect(PUSH_MENSAGEM_TITULO).toBe("Nova mensagem");
    expect(PUSH_MENSAGEM_CORPO).toBe("Toque para abrir.");
  });
});
