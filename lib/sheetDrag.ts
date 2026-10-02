/**
 * Decisões puras do "arrastar pra baixo pra fechar" dos bottom sheets
 * (components/ui/BottomSheet.tsx). Separado pra ser testável sem DOM.
 */

/**
 * Resistência ao puxar o sheet pra CIMA além da posição aberta — o painel
 * cede um pouco e volta, como a borracha do iOS, em vez de travar seco.
 */
export function rubberBandSheet(dy: number): number {
  if (dy >= 0) return dy;
  return -Math.min(24, Math.sqrt(-dy) * 2);
}

/**
 * Ao soltar: fecha se arrastou mais de 25% da altura do painel, ou num
 * "flick" rápido pra baixo. Flick pra cima sempre mantém aberto.
 *
 * @param velocity px/ms, positiva = pra baixo
 */
export function shouldDismissSheet(
  dy: number,
  height: number,
  velocity: number
): boolean {
  if (dy <= 0) return false;
  if (velocity < -0.2) return false;
  if (velocity > 0.5) return true;
  return dy > height * 0.25;
}
