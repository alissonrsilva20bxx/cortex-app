/**
 * Formatos de foto do feed da Rede, como o Instagram (proposta "Três abas,
 * fotos no formato do Instagram", proporções confirmadas pelo operador em
 * feed-proporcoes.html):
 *
 *   4:5     retrato, o mais alto permitido   390×488 · 430×538
 *   1:1     quadrado                          390×390 · 430×430
 *   16:9    paisagem aceita pelo app          390×219 · 430×242
 *   1,91:1  paisagem, a mais larga permitida  390×204 · 430×225
 *
 * Regra, em ordem (a mesma da página de proporções):
 *  1. proporção da foto = largura ÷ altura;
 *  2. vai para o formato permitido mais próximo; abaixo de 0,8 vira 4:5 e
 *     acima de 1,91 vira 1,91:1;
 *  3. enquadra centrado e tira só das bordas;
 *  4. se o recorte cortaria a área segura, não corta: a foto aparece
 *     inteira, com o próprio fundo desfocado na sobra.
 * Nunca estica nem achata.
 *
 * Área segura: o miolo da foto que nunca é cortado. O app não sabe onde
 * está o rosto, então ela é centrada: {@link AREA_SEGURA} da dimensão que
 * seria cortada. Recortes que mantêm pelo menos isso são feitos; os que
 * tirariam mais viram "inteira".
 *
 * Lógica pura (sem DOM): testada em tests/lib/redeFormatoFoto.test.ts.
 */

export type FormatoId = "4:5" | "1:1" | "16:9" | "1,91:1";

export interface Formato {
  id: FormatoId;
  /** largura ÷ altura */
  ratio: number;
  rotulo: string;
}

/** Do mais alto ao mais largo. */
export const FORMATOS: readonly Formato[] = [
  { id: "4:5", ratio: 4 / 5, rotulo: "Retrato 4:5" },
  { id: "1:1", ratio: 1, rotulo: "Quadrado 1:1" },
  { id: "16:9", ratio: 16 / 9, rotulo: "Paisagem 16:9" },
  { id: "1,91:1", ratio: 1.91, rotulo: "Paisagem 1,91:1" },
];

const PORTA_ALTA = FORMATOS[0];
const PORTA_LARGA = FORMATOS[FORMATOS.length - 1];

/** Fração mínima da foto que o recorte mantém na dimensão cortada. */
export const AREA_SEGURA = 0.8;

export function formatoPorId(id: FormatoId): Formato {
  return FORMATOS.find((f) => f.id === id) ?? FORMATOS[1];
}

/** O formato permitido mais próximo da proporção (distância em escala
 * logarítmica: 4:5 → 1:1 pesa igual a 1:1 → 5:4). Proporção inválida
 * (0, negativa, NaN) cai no quadrado. */
export function formatoMaisProximo(ratio: number): Formato {
  if (!Number.isFinite(ratio) || ratio <= 0) return FORMATOS[1];
  if (ratio <= PORTA_ALTA.ratio) return PORTA_ALTA;
  if (ratio >= PORTA_LARGA.ratio) return PORTA_LARGA;
  let melhor = FORMATOS[0];
  let menor = Infinity;
  for (const f of FORMATOS) {
    const d = Math.abs(Math.log(ratio / f.ratio));
    if (d < menor) {
      menor = d;
      melhor = f;
    }
  }
  return melhor;
}

export type Encaixe = "cortar" | "inteira";

/**
 * Como a foto de proporção `ratioFoto` entra num quadro de proporção
 * `ratioQuadro`: "cortar" (preenche o quadro, centrada, tirando só das
 * bordas) quando o que sobra é pelo menos a área segura; senão "inteira"
 * (cabe toda, com o fundo desfocado dela na sobra).
 */
export function encaixeNoQuadro(
  ratioFoto: number,
  ratioQuadro: number
): Encaixe {
  if (!Number.isFinite(ratioFoto) || ratioFoto <= 0) return "inteira";
  const mantem = Math.min(ratioFoto / ratioQuadro, ratioQuadro / ratioFoto);
  return mantem >= AREA_SEGURA - 1e-9 ? "cortar" : "inteira";
}

/** Altura do quadro em pixels inteiros para a largura da tela (390 → 488 no
 * 4:5, 219 no 16:9, 204 no 1,91:1). */
export function alturaDoQuadro(largura: number, formato: Formato): number {
  return Math.round(largura / formato.ratio);
}

/**
 * Carrossel: todos os slides na proporção da 1ª foto (como o Instagram).
 * Um slide entra recortado só se o formato dele for o mesmo do quadro e o
 * recorte respeitar a área segura; com outra proporção, aparece inteiro,
 * com o fundo desfocado.
 */
export function encaixeDoSlide(
  ratioSlide: number | null,
  quadro: Formato
): Encaixe {
  if (ratioSlide == null) return "inteira";
  if (formatoMaisProximo(ratioSlide).id !== quadro.id) return "inteira";
  return encaixeNoQuadro(ratioSlide, quadro.ratio);
}
