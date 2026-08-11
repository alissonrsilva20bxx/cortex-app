/**
 * Ciclo de foco de um diálogo modal (focus trap), extraído como função
 * pura testável — mesmo padrão de `components/cofre/lockGate.ts` (T5).
 * Usada por `BottomSheet.tsx` (T6 — relatório de paridade do Gate da
 * Rede, achado P1-3): o shell compartilhado não tinha focus trap,
 * `role="dialog"`, fechar com Esc nem restauração de foco — o
 * laboratório (`NetworkGateScreen.tsx:80-116`) já resolvia isso.
 * Corrigido na causa-raiz (~18 consumidores), não só nos sheets do gate.
 */

/**
 * Dado o Tab (ou Shift+Tab) apertado com `active` focado, decide se o
 * ciclo precisa dar a volta (primeiro↔último) e pra qual elemento. `null`
 * significa "não intervir" — deixa o navegador mover o foco normalmente
 * dentro do sheet.
 */
export function getFocusCycleTarget<T>(
  items: T[],
  active: T | null | undefined,
  shiftKey: boolean
): T | null {
  if (items.length === 0) return null;
  const first = items[0];
  const last = items[items.length - 1];
  if (shiftKey && active === first) return last;
  if (!shiftKey && active === last) return first;
  return null;
}
