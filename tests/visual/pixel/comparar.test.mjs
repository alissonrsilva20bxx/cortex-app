// Teste das funções puras de tests/visual/pixel/comparar.mjs.
//
// Roda no runner embutido do Node, sem dependência e sem npm install:
//
//     node --test tests/visual/pixel/comparar.test.mjs
//
// Não entra no vitest de propósito: o `include` do projeto é `tests/**/*.test.ts`
// e os harnesses visuais (`.mjs`) ficam fora dele por convenção. O módulo só
// sobe navegador quando é chamado como programa, então importá-lo aqui não
// abre nada nem precisa de servidor.
//
// Cobre o que a ferramenta tem de lógica própria, que é onde ela pode errar
// em silêncio e estragar toda medição depois:
//   - o pareamento dos elementos (por texto com número mascarado, e por
//     geometria no que sobra);
//   - a normalização (família do next/font, raio de pílula, cor, teto por
//     propriedade);
//   - o diff de pixel, inclusive entre imagens de tamanhos diferentes.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chaveDeTexto,
  comparar,
  corEmRgb,
  diferenca,
  familia,
  medirPixels,
  parear,
  censoDeFontes,
  TETO_POR_PROPRIEDADE,
} from "./comparar.mjs";

/**
 * `expect` mínimo sobre o node:assert -- só os matchers usados aqui. Evita
 * trazer dependência nova só para ler bonito.
 */
function expect(valor) {
  return {
    toBe: (esperado) => assert.strictEqual(valor, esperado),
    toEqual: (esperado) => assert.deepStrictEqual(valor, esperado),
    toBeNull: () => assert.strictEqual(valor, null),
    toHaveLength: (n) => assert.strictEqual(valor.length, n),
    toBeGreaterThan: (n) => assert.ok(valor > n, `${valor} não é > ${n}`),
    toBeLessThanOrEqual: (n) => assert.ok(valor <= n, `${valor} não é <= ${n}`),
    not: {
      toBeNull: () => assert.notStrictEqual(valor, null),
    },
  };
}

// ---------------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------------

const ESTILO_PADRAO = {
  fontFamily: "Plus Jakarta Sans",
  fontSize: "14px",
  fontWeight: "400",
  letterSpacing: "normal",
  lineHeight: "21px",
  textTransform: "none",
  color: "rgb(0, 0, 0)",
  backgroundColor: "rgba(0, 0, 0, 0)",
  borderRadius: "0px 0px 0px 0px",
  padding: "0px 0px 0px 0px",
  gap: "normal",
  boxShadow: "none",
};

const el = (p = {}) => ({
  tag: "div",
  profundidade: 1,
  texto: "",
  x: 0,
  y: 0,
  largura: 100,
  altura: 20,
  ...p,
  estilos: { ...ESTILO_PADRAO, ...(p.estilos ?? {}) },
});

/** Imagem RGBA sólida de uma cor só. */
function lona(largura, altura, [r, g, b]) {
  const d = new Uint8ClampedArray(largura * altura * 4);
  for (let i = 0; i < largura * altura; i++) {
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Pareamento
// ---------------------------------------------------------------------------

describe("pareamento", () => {
  it("casa pelo texto mesmo com números diferentes (o dado do laboratório não é o do mockup)", () => {
    const mock = [el({ texto: "R$ 430", y: 10 })];
    const app = [el({ texto: "R$ 150", y: 12 })];
    const { pares, semParNoMockup } = {
      ...parear(mock, app),
      semParNoMockup: parear(mock, app).semParMock.length,
    };
    expect(pares).toHaveLength(1);
    expect(pares[0].como).toBe("texto");
    expect(semParNoMockup).toBe(0);
  });

  it("entre homônimos, escolhe o mais perto e não reusa o mesmo elemento", () => {
    const mock = [el({ texto: "Meta", y: 0 }), el({ texto: "Meta", y: 300 })];
    const app = [el({ texto: "Meta", y: 310 }), el({ texto: "Meta", y: 4 })];
    const { pares } = parear(mock, app);
    expect(pares).toHaveLength(2);
    expect(pares[0].app.y).toBe(4);
    expect(pares[1].app.y).toBe(310);
  });

  it("texto que só existe num lado fica sem par, em vez de casar errado", () => {
    const mock = [el({ texto: "Extrato ›" })];
    const app = [el({ texto: "Ver tudo ›" })];
    const { pares, semParMock, semParApp } = parear(mock, app);
    expect(pares).toHaveLength(0);
    expect(semParMock).toHaveLength(1);
    expect(semParApp).toHaveLength(1);
  });

  it("caixa sem texto casa pela geometria quando o tamanho e o lugar batem", () => {
    const mock = [el({ largura: 100, altura: 50, x: 10, y: 10 })];
    const app = [el({ largura: 104, altura: 52, x: 12, y: 11 })];
    const { pares } = parear(mock, app);
    expect(pares).toHaveLength(1);
    expect(pares[0].como).toBe("geometria");
  });

  it("caixa longe demais ou de tamanho muito diferente NÃO casa", () => {
    const mock = [el({ largura: 100, altura: 50, x: 0, y: 0 })];
    const longe = [el({ largura: 100, altura: 50, x: 0, y: 500 })];
    const grande = [el({ largura: 300, altura: 50, x: 0, y: 0 })];
    expect(parear(mock, longe).pares).toHaveLength(0);
    expect(parear(mock, grande).pares).toHaveLength(0);
  });

  it("caixa sem texto nunca casa com elemento que tem texto", () => {
    const mock = [el({ largura: 100, altura: 50 })];
    const app = [el({ texto: "oi", largura: 100, altura: 50 })];
    expect(parear(mock, app).pares).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

describe("normalização", () => {
  it("chaveDeTexto mascara os números e achata o espaço", () => {
    expect(chaveDeTexto("R$ 1.234,56")).toBe(chaveDeTexto("R$ 9.876,54"));
    expect(chaveDeTexto("  Olá,   Miguel ")).toBe("olá, miguel");
  });

  it("o nome gerado pelo next/font é a MESMA família (senão tudo divergiria)", () => {
    expect(familia("__plus_jakarta_sans_a11773")).toBe("plus jakarta sans");
    expect(
      diferenca("fontFamily", "Plus Jakarta Sans", "__plus_jakarta_sans_a11773")
    ).toBeNull();
  });

  it("família de verdade diferente continua sendo divergência", () => {
    const d = diferenca("fontFamily", "Plus Jakarta Sans", "-apple-system");
    expect(d).not.toBeNull();
    expect(d.a).toBe("plus jakarta sans");
    expect(d.b).toBe("-apple-system");
  });

  it("raio de pílula: 999 e 9999 são o mesmo desenho", () => {
    expect(
      diferenca(
        "borderRadius",
        "999px 999px 999px 999px",
        "9999px 9999px 9999px 9999px"
      )
    ).toBeNull();
    expect(
      diferenca(
        "borderRadius",
        "0px 0px 0px 0px",
        "9999px 9999px 9999px 9999px"
      )
    ).not.toBeNull();
  });

  it("transparente dos dois lados não é divergência de cor", () => {
    expect(
      diferenca("backgroundColor", "rgba(0, 0, 0, 0)", "rgba(255, 255, 255, 0)")
    ).toBeNull();
  });

  it("corEmRgb entende rgb, rgba e a forma com barra", () => {
    expect(corEmRgb("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(corEmRgb("rgba(1, 2, 3, 0.5)")).toEqual({
      r: 1,
      g: 2,
      b: 3,
      a: 0.5,
    });
    expect(corEmRgb("rgb(1 2 3 / 0.5)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(corEmRgb("nada")).toBeNull();
  });

  it("nenhuma propriedade sozinha passa do teto", () => {
    // 9999px contra 0px daria peso 3333 sem o achatamento e sem o teto.
    const d = diferenca(
      "borderRadius",
      "0px 0px 0px 0px",
      "9999px 9999px 9999px 9999px"
    );
    expect(d.peso).toBeLessThanOrEqual(TETO_POR_PROPRIEDADE);
  });

  it("diferença abaixo do ruído não vira divergência", () => {
    expect(diferenca("fontSize", "14px", "14.2px")).toBeNull();
    expect(diferenca("fontWeight", "400", "400")).toBeNull();
  });

  it("censoDeFontes conta só quem mostra texto", () => {
    const itens = [
      el({ texto: "a" }),
      el({ texto: "b" }),
      el({ texto: "", estilos: { fontFamily: "Arial" } }),
    ];
    expect(censoDeFontes(itens)).toEqual({ "plus jakarta sans": 2 });
  });
});

// ---------------------------------------------------------------------------
// Ordenação por impacto
// ---------------------------------------------------------------------------

describe("impacto", () => {
  it("a mesma diferença pesa mais no elemento maior", () => {
    const comTamanho = (largura, altura) => ({
      itens: [
        el({ texto: "oi", largura, altura, estilos: { fontSize: "11px" } }),
      ],
      area: 390 * 844,
    });
    const app = (largura, altura) => ({
      itens: [
        el({ texto: "oi", largura, altura, estilos: { fontSize: "14px" } }),
      ],
      area: 390 * 844,
    });
    const pequeno = comparar(comTamanho(20, 10), app(20, 10), 390 * 844);
    const grande = comparar(comTamanho(300, 200), app(300, 200), 390 * 844);
    expect(grande.linhas[0].impacto).toBeGreaterThan(pequeno.linhas[0].impacto);
  });

  it("elemento sem nenhuma divergência não entra na lista", () => {
    const lado = { itens: [el({ texto: "igual" })], area: 1000 };
    const r = comparar(lado, lado, 1000);
    expect(r.comDivergencia).toBe(0);
    expect(r.impactoTotal).toBe(0);
  });

  it("separa o ranking dos elementos com texto", () => {
    const mock = {
      itens: [
        el({ texto: "letra", estilos: { fontSize: "11px" } }),
        el({
          largura: 100,
          altura: 50,
          estilos: { backgroundColor: "rgb(0, 0, 0)" },
        }),
      ],
      area: 1000,
    };
    const app = {
      itens: [
        el({ texto: "letra", estilos: { fontSize: "20px" } }),
        el({
          largura: 100,
          altura: 50,
          estilos: { backgroundColor: "rgb(255, 255, 255)" },
        }),
      ],
      area: 1000,
    };
    const r = comparar(mock, app, 1000);
    expect(r.comDivergencia).toBe(2);
    expect(r.comTextoDivergindo).toBe(1);
    expect(r.pioresComTexto[0].texto).toBe("letra");
  });
});

// ---------------------------------------------------------------------------
// Diff de pixel
// ---------------------------------------------------------------------------

describe("diff de pixel (métrica do pixelmatch, YIQ)", () => {
  const base = { larguraA: 10, alturaA: 10, larguraB: 10, alturaB: 10 };

  it("imagens iguais dão 0%", () => {
    const a = lona(10, 10, [120, 130, 140]);
    const r = medirPixels({ ...base, a, b: lona(10, 10, [120, 130, 140]) });
    expect(r.diferentes).toBe(0);
    expect(r.difPct).toBe(0);
    expect(r.mesmoTamanho).toBe(true);
  });

  it("preto contra branco dá 100%", () => {
    const r = medirPixels({
      ...base,
      a: lona(10, 10, [0, 0, 0]),
      b: lona(10, 10, [255, 255, 255]),
    });
    expect(r.diferentes).toBe(100);
    expect(r.difPct).toBe(100);
  });

  it("diferença pequena de cor fica abaixo do limiar 0,1 (é o ponto da métrica)", () => {
    const r = medirPixels({
      ...base,
      a: lona(10, 10, [120, 120, 120]),
      b: lona(10, 10, [123, 123, 123]),
    });
    expect(r.diferentes).toBe(0);
  });

  it("limiar menor passa a acusar a mesma diferença", () => {
    const par = {
      ...base,
      a: lona(10, 10, [120, 120, 120]),
      b: lona(10, 10, [123, 123, 123]),
    };
    expect(medirPixels({ ...par, limiar: 0.1 }).diferentes).toBe(0);
    expect(medirPixels({ ...par, limiar: 0.005 }).diferentes).toBe(100);
  });

  it("usa a constante do pixelmatch: 35215 × limiar²", () => {
    // Cinza 120 contra 140: só luminância, delta YIQ = 0,5053 × 20² = 202,1.
    // O limiar vira 35215 × t², então o ponto de virada está em t ≈ 0,0757:
    // com 0,07 (172,6) o pixel conta; com 0,08 (225,4) não conta. Isso
    // prende a FÓRMULA, não só o sentido -- trocar a constante quebra aqui.
    const par = {
      ...base,
      a: lona(10, 10, [120, 120, 120]),
      b: lona(10, 10, [140, 140, 140]),
    };
    expect(medirPixels({ ...par, limiar: 0.07 }).diferentes).toBe(100);
    expect(medirPixels({ ...par, limiar: 0.08 }).diferentes).toBe(0);
  });

  it("a métrica é YIQ, não RGB: a mesma distância RGB pesa diferente por canal", () => {
    // Em RGB cru, +30 no verde e +30 no azul são a MESMA distância. Em YIQ
    // não: o verde domina a luminância (delta 224,8) e o azul quase não
    // mexe nela (delta 50,9). Num limiar entre os dois (0,06 → 126,8), só o
    // verde conta. É exatamente isso que distingue esta métrica da anterior.
    const cinza = lona(4, 4, [100, 100, 100]);
    const medir = (cor) =>
      medirPixels({
        a: cinza,
        b: lona(4, 4, cor),
        larguraA: 4,
        alturaA: 4,
        larguraB: 4,
        alturaB: 4,
        limiar: 0.06,
      }).diferentes;
    expect(medir([100, 130, 100])).toBe(16);
    expect(medir([100, 100, 130])).toBe(0);
  });

  it("tamanhos diferentes: compara a sobreposição e conta o resto como diferente", () => {
    // 10x10 igual contra 10x20: a metade de baixo só existe num lado.
    const r = medirPixels({
      a: lona(10, 10, [50, 50, 50]),
      b: lona(10, 20, [50, 50, 50]),
      larguraA: 10,
      alturaA: 10,
      larguraB: 10,
      alturaB: 20,
    });
    expect(r.largura).toBe(10);
    expect(r.altura).toBe(20);
    expect(r.pixels).toBe(200);
    expect(r.diferentes).toBe(100);
    expect(r.difPct).toBe(50);
    expect(r.mesmoTamanho).toBe(false);
  });

  it("tamanhos diferentes na largura também contam", () => {
    const r = medirPixels({
      a: lona(10, 10, [50, 50, 50]),
      b: lona(20, 10, [50, 50, 50]),
      larguraA: 10,
      alturaA: 10,
      larguraB: 20,
      alturaB: 10,
    });
    expect(r.diferentes).toBe(100);
    expect(r.mesmoTamanho).toBe(false);
  });

  it("a máscara marca exatamente os pixels contados", () => {
    const a = lona(4, 4, [0, 0, 0]);
    const b = lona(4, 4, [0, 0, 0]);
    // Um pixel branco no meio da segunda imagem.
    const p = (1 * 4 + 2) * 4;
    b[p] = b[p + 1] = b[p + 2] = 255;
    const r = medirPixels({
      a,
      b,
      larguraA: 4,
      alturaA: 4,
      larguraB: 4,
      alturaB: 4,
    });
    expect(r.diferentes).toBe(1);
    expect(r.mascara[1 * 4 + 2]).toBe(1);
    expect([...r.mascara].reduce((s, v) => s + v, 0)).toBe(1);
  });
});
