import { describe, expect, it } from "vitest";
import {
  AREA_SEGURA,
  FORMATOS,
  alturaDoQuadro,
  encaixeDoSlide,
  encaixeNoQuadro,
  formatoMaisProximo,
  formatoPorId,
} from "@/lib/rede/formatoFoto";

/**
 * Formatos de foto do feed (proposta "Três abas"; proporções confirmadas
 * em feed-proporcoes.html). A lógica roda de verdade aqui.
 */

describe("os 4 formatos e as medidas em pixels", () => {
  it("são 4:5, 1:1, 16:9 e 1,91:1, do mais alto ao mais largo", () => {
    expect(FORMATOS.map((f) => f.id)).toEqual(["4:5", "1:1", "16:9", "1,91:1"]);
    expect(FORMATOS.map((f) => f.ratio)).toEqual([0.8, 1, 16 / 9, 1.91]);
  });

  it("390 de largura: 488, 390, 219 e 204", () => {
    expect(FORMATOS.map((f) => alturaDoQuadro(390, f))).toEqual([
      488, 390, 219, 204,
    ]);
  });

  it("430 de largura: 538, 430, 242 e 225", () => {
    expect(FORMATOS.map((f) => alturaDoQuadro(430, f))).toEqual([
      538, 430, 242, 225,
    ]);
  });
});

describe("formatoMaisProximo", () => {
  it("cada formato exato fica nele mesmo", () => {
    for (const f of FORMATOS) expect(formatoMaisProximo(f.ratio).id).toBe(f.id);
  });

  it("mais alta que 4:5 vira 4:5; mais larga que 1,91:1 vira 1,91:1", () => {
    expect(formatoMaisProximo(9 / 16).id).toBe("4:5");
    expect(formatoMaisProximo(0.3).id).toBe("4:5");
    expect(formatoMaisProximo(2.4).id).toBe("1,91:1");
    expect(formatoMaisProximo(5).id).toBe("1,91:1");
  });

  it("no meio, o mais próximo em escala logarítmica", () => {
    expect(formatoMaisProximo(3 / 4).id).toBe("4:5");
    expect(formatoMaisProximo(0.88).id).toBe("4:5"); // |ln(.88/.8)| < |ln(.88)|
    expect(formatoMaisProximo(0.9).id).toBe("1:1"); // |ln(.9)| < |ln(.9/.8)|
    expect(formatoMaisProximo(0.95).id).toBe("1:1");
    expect(formatoMaisProximo(4 / 3).id).toBe("1:1"); // 1,33 → mais perto de 1
    expect(formatoMaisProximo(1.4).id).toBe("16:9");
    expect(formatoMaisProximo(1.85).id).toBe("1,91:1");
    expect(formatoMaisProximo(1.8).id).toBe("16:9");
  });

  it("proporção inválida cai no quadrado", () => {
    expect(formatoMaisProximo(0).id).toBe("1:1");
    expect(formatoMaisProximo(-1).id).toBe("1:1");
    expect(formatoMaisProximo(Number.NaN).id).toBe("1:1");
  });
});

describe("encaixeNoQuadro: corta só as bordas, nunca a área segura", () => {
  it("a área segura é 80% da dimensão cortada", () => {
    expect(AREA_SEGURA).toBe(0.8);
  });

  it("foto exata no formato: corta (nada sai)", () => {
    expect(encaixeNoQuadro(0.8, 0.8)).toBe("cortar");
    expect(encaixeNoQuadro(1.91, 1.91)).toBe("cortar");
  });

  it("3:4 num quadro 4:5: mantém 93,75% → corta", () => {
    expect(encaixeNoQuadro(3 / 4, 0.8)).toBe("cortar");
  });

  it("9:16 num quadro 4:5: manteria 70% → inteira, com fundo desfocado", () => {
    expect(encaixeNoQuadro(9 / 16, 0.8)).toBe("inteira");
  });

  it("exatamente na borda da área segura ainda corta", () => {
    expect(encaixeNoQuadro(0.8 * 0.8, 0.8)).toBe("cortar");
    expect(encaixeNoQuadro(0.8 * 0.79, 0.8)).toBe("inteira");
  });

  it("2,4:1 num quadro 1,91:1: manteria 79,6% → inteira", () => {
    expect(encaixeNoQuadro(2.4, 1.91)).toBe("inteira");
  });

  it("proporção inválida aparece inteira", () => {
    expect(encaixeNoQuadro(0, 1)).toBe("inteira");
    expect(encaixeNoQuadro(Number.NaN, 1)).toBe("inteira");
  });
});

describe("encaixeDoSlide: o carrossel fica na proporção da 1ª foto", () => {
  const quadrado = formatoPorId("1:1");

  it("slide do mesmo formato do quadro: corta", () => {
    expect(encaixeDoSlide(1, quadrado)).toBe("cortar");
    expect(encaixeDoSlide(1.05, quadrado)).toBe("cortar");
  });

  it("slide de outro formato: aparece inteiro, nunca cortado", () => {
    expect(encaixeDoSlide(16 / 9, quadrado)).toBe("inteira");
    expect(encaixeDoSlide(0.8, quadrado)).toBe("inteira");
  });

  it("slide sem proporção conhecida: inteiro", () => {
    expect(encaixeDoSlide(null, quadrado)).toBe("inteira");
  });
});
