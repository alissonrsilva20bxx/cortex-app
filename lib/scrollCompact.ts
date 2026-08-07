/**
 * Decide se a BottomNav deve estar "compacta" a partir da posição de
 * rolagem — pura e sem DOM para poder ser testada isoladamente do React.
 * A lógica de histerese (zona de expansão perto do topo + limiar mínimo de
 * movimento) existe para não oscilar a cada pequeno gesto de rolagem.
 */

export interface ScrollCompactConfig {
  /** Perto do topo, sempre expandida — evita ficar compacta colada no início. */
  expandZone: number;
  /** Só compacta depois de descer além disso, mesmo se já estiver descendo. */
  compactZone: number;
  /** Movimentos menores que isso são ruído (rebote elástico, jitter) — ignorados. */
  minDelta: number;
}

export const DEFAULT_SCROLL_COMPACT_CONFIG: ScrollCompactConfig = {
  expandZone: 8,
  compactZone: 40,
  minDelta: 6,
};

export interface ScrollCompactState {
  compact: boolean;
  /** `null` até a primeira leitura — evita um salto de "delta" contra um baseline desconhecido. */
  lastScrollTop: number | null;
}

export const INITIAL_SCROLL_COMPACT_STATE: ScrollCompactState = {
  compact: false,
  lastScrollTop: null,
};

export function nextScrollCompactState(
  state: ScrollCompactState,
  rawScrollTop: number,
  config: ScrollCompactConfig = DEFAULT_SCROLL_COMPACT_CONFIG
): ScrollCompactState {
  // Bounce elástico (iOS) pode entregar valores negativos — não é rolagem real.
  const scrollTop = Math.max(0, rawScrollTop);

  if (state.lastScrollTop === null) {
    return { compact: state.compact, lastScrollTop: scrollTop };
  }

  if (scrollTop <= config.expandZone) {
    return { compact: false, lastScrollTop: scrollTop };
  }

  const delta = scrollTop - state.lastScrollTop;

  if (Math.abs(delta) < config.minDelta) {
    return { compact: state.compact, lastScrollTop: scrollTop };
  }

  if (delta > 0 && scrollTop > config.compactZone) {
    return { compact: true, lastScrollTop: scrollTop };
  }

  if (delta < 0) {
    return { compact: false, lastScrollTop: scrollTop };
  }

  return { compact: state.compact, lastScrollTop: scrollTop };
}
