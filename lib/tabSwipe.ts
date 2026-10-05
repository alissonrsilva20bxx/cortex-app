import type { TabId } from "@/lib/types";

/**
 * Decisões puras do gesto "arrastar pro lado pra trocar de aba" (Início →
 * Agenda → Financeiro → Cofre → Rede, a mesma ordem da barra de abas).
 * Separado do hook (`lib/useTabSwipe.ts`) pra ser testável sem DOM.
 */

/** Ordem das abas no gesto -- a mesma da BottomNav. Ajustes fica fora. */
export const TAB_SWIPE_ORDER: TabId[] = [
  "home",
  "jobs",
  "financeiro",
  "cofre",
  "rede",
];

/**
 * Faixa (px) junto às bordas em que o gesto NÃO começa: a borda esquerda é
 * do "arrastar pra voltar" da Rede (e do voltar do Safari em aba) e a
 * direita, do avançar do Safari.
 */
export const TAB_SWIPE_EDGE = 24;

/** Movimento mínimo (px) antes de decidir se o gesto é horizontal. */
export const TAB_SWIPE_SLOP = 10;

/**
 * Aba vizinha na direção do arraste. Dedo indo pra esquerda (`dx < 0`) =
 * próxima aba; pra direita = anterior. `null` nas pontas ou fora da ordem.
 */
export function neighborTab(current: TabId, dx: number): TabId | null {
  const i = TAB_SWIPE_ORDER.indexOf(current);
  if (i < 0 || dx === 0) return null;
  const j = dx < 0 ? i + 1 : i - 1;
  return TAB_SWIPE_ORDER[j] ?? null;
}

/**
 * Engata só quando o movimento é claramente horizontal -- qualquer coisa
 * mais inclinada continua sendo rolagem vertical normal.
 */
export function shouldEngageTabSwipe(dx: number, dy: number): boolean {
  if (Math.abs(dx) < TAB_SWIPE_SLOP && Math.abs(dy) < TAB_SWIPE_SLOP) {
    return false;
  }
  return Math.abs(dx) > Math.abs(dy) * 1.4;
}

/**
 * Ao soltar: troca se passou de 28% da largura, ou num "flick" rápido na
 * mesma direção do arraste. Flick no sentido contrário sempre cancela.
 *
 * @param velocity px/ms, mesmo sinal de `dx` = mesma direção
 */
export function shouldCompleteTabSwipe(
  dx: number,
  width: number,
  velocity: number
): boolean {
  if (dx === 0) return false;
  const sameDir = Math.sign(velocity) === Math.sign(dx);
  if (!sameDir && Math.abs(velocity) > 0.3) return false;
  if (sameDir && Math.abs(velocity) > 0.35 && Math.abs(dx) > 30) return true;
  return Math.abs(dx) > width * 0.28;
}
