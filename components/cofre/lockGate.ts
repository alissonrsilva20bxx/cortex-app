/**
 * Estado de trava do Cofre, extraído como funções puras — única fonte de
 * verdade usada tanto por `CofreTab.tsx` quanto pelos testes
 * (`tests/wiring/cofre-lock-gate.test.ts`). Existe pra permitir um teste
 * determinístico de verdade (sequência de eventos → estado esperado), não
 * só grep de texto no código fonte — grep não pegou o bug corrigido aqui
 * (o gate renderizava o portal do PinScreen mesmo com `active=false`).
 */

export type GateState = "hidden" | "locked" | "content";

interface GateParams {
  /** Se a aba Cofre é a aba selecionada agora. */
  active: boolean;
  /** Hash do PIN real do app, ou `null` se nunca configurado. */
  pinHash: string | null;
  /** Estado de desbloqueio próprio do Cofre (não o `locked` do app). */
  unlocked: boolean;
}

/**
 * Decide o que renderizar. Regra: `active` vence sempre — só é seguro
 * mostrar QUALQUER coisa (locked ou content) quando o Cofre é de fato a
 * aba selecionada. Fora dela, nada — nem o portal do PinScreen (senão
 * ele aparece "atrasado" numa aba errada), nem o conteúdo sensível.
 */
export function computeGateState({
  active,
  pinHash,
  unlocked,
}: GateParams): GateState {
  if (!active) return "hidden";
  if (pinHash && !unlocked) return "locked";
  return "content";
}

/** O que `unlocked` deve valer depois que `active` muda. Sair da aba
 * (active vira false) sempre rebloqueia; entrar não desbloqueia sozinho. */
export function nextUnlockedOnActiveChange(
  active: boolean,
  prevUnlocked: boolean
): boolean {
  return active ? prevUnlocked : false;
}

/** O que `unlocked` deve valer ao perder foco/visibilidade/pagehide —
 * sempre `false`, sem exceção, sem período de graça. */
export function nextUnlockedOnLoseFocus(): boolean {
  return false;
}
