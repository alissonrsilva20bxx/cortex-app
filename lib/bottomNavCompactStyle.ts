/**
 * Valores de forma da BottomNav para os estados expandido/compacto —
 * espelha fielmente o efeito aprovado no laboratório visual
 * (`jobapp-visual-launch`, `/dev-preview/launch`, `data-compact` na pílula
 * + `.jobapp-bottom-nav[data-compact="true"]` em globals.css): a pílula
 * *encolhe* (bordas avançam, padding cai, botão ativo estreita) com só um
 * leve acomodar vertical — não é um slide pra fora de tela.
 *
 * Extraído como dado puro (em vez de inline no componente) pra poder ser
 * testado sem depender de DOM/React, e pra impedir que uma futura edição
 * reintroduza sem querer um deslocamento grande (o bug anterior usava
 * `translateY(42%)`, que lia como "esconder", não "compactar").
 */

export interface BottomNavCompactStyle {
  /** `left`/`right` do container, em px — menor = pílula mais estreita. */
  edgeInset: number;
  /** padding interno do container, em px. */
  padding: number;
  /** acomodo vertical sutil, em px — não é um recolhimento pra fora da tela. */
  translateY: number;
  /** largura do botão ativo, em px. */
  activeWidth: number;
  /** opacidade do fundo (canal alfa de `--bg-rgb`). */
  backgroundOpacity: number;
  /** `box-shadow` completo — mais leve no compacto, pílula "pesa" menos. */
  shadow: string;
}

/**
 * Touch target mínimo (WCAG 2.5.5 / fb6b6c9) — vale para TODOS os botões
 * em QUALQUER estado. O laboratório encolhe o botão inativo pra 40px
 * porque nunca passou por esse fix; o app funcional não pode regredir
 * isso, então largura/altura dos botões inativos ficam fora deste struct
 * e são sempre fixadas nesta constante no componente.
 */
export const BOTTOM_NAV_MIN_TOUCH_TARGET = 44;

export const BOTTOM_NAV_EXPANDED: BottomNavCompactStyle = {
  edgeInset: 18,
  padding: 8,
  translateY: 0,
  activeWidth: 56,
  backgroundOpacity: 0.72,
  shadow: "0 16px 40px rgb(0 0 0 / 0.45)",
};

export const BOTTOM_NAV_COMPACT: BottomNavCompactStyle = {
  edgeInset: 44,
  padding: 3,
  translateY: 8,
  activeWidth: 44,
  backgroundOpacity: 0.9,
  shadow: "0 6px 20px rgb(0 0 0 / 0.3)",
};

export function getBottomNavCompactStyle(
  compact: boolean
): BottomNavCompactStyle {
  return compact ? BOTTOM_NAV_COMPACT : BOTTOM_NAV_EXPANDED;
}
