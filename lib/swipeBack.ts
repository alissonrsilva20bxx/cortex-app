/**
 * Decisões puras do gesto "arrastar da borda pra voltar" (estilo iOS) da
 * pilha de telas da Rede. Separado do hook pra ser testável sem DOM.
 */

/** Distância da borda esquerda (px) em que um toque pode iniciar o gesto. */
export const SWIPE_BACK_EDGE = 20;

/** Movimento mínimo (px) antes de decidir se o gesto é horizontal. */
export const SWIPE_BACK_SLOP = 8;

/**
 * O gesto só engata se o movimento for claramente pra direita — um toque na
 * borda que vira rolagem vertical continua sendo rolagem.
 */
export function shouldEngageSwipeBack(dx: number, dy: number): boolean {
  if (Math.abs(dx) < SWIPE_BACK_SLOP && Math.abs(dy) < SWIPE_BACK_SLOP) {
    return false;
  }
  return dx > 0 && Math.abs(dy) <= dx * 0.7;
}

/**
 * Ao soltar o dedo: completa a volta se passou de 40% da largura, ou se foi
 * um "flick" rápido pra direita (como no iOS, um arraste curto e rápido
 * também volta). Flick pra esquerda sempre cancela.
 *
 * @param velocity px/ms, positiva = pra direita
 */
export function shouldCompleteSwipeBack(
  dx: number,
  width: number,
  velocity: number
): boolean {
  if (dx <= 0) return false;
  if (velocity < -0.3) return false;
  if (velocity > 0.45) return true;
  return dx > width * 0.4;
}
