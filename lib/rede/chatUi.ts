/** Lógica pura de UI de chat/notificações -- framework-agnóstica de
 * propósito, para poder ser testada com vitest (ambiente "node", sem
 * jsdom, sem resolução de alias `@/`) sem precisar renderizar componente
 * nenhum. Nenhuma destas funções fala com Supabase; a leitura real de
 * `visualViewport`/`scrollY`/`matchMedia` fica em ChatThreadScreen.tsx,
 * que só chama estas funções com os números já extraídos do DOM. */

export type ShouldAutoScrollInput = {
  /** Distância, em px, entre o fundo do conteúdo e o fundo do viewport
   * visível ANTES da mensagem nova chegar. 0 = já está no fundo. */
  distanceFromBottomPx: number;
  isOwnMessage: boolean;
  thresholdPx?: number;
};

const DEFAULT_NEAR_BOTTOM_THRESHOLD_PX = 120;

/** Mensagem própria sempre rola para o fundo (é o próprio envio, a
 * autora precisa ver a bolha que acabou de mandar). Mensagem de outra
 * pessoa só rola automaticamente se quem está lendo já estiver perto do
 * fundo -- do contrário interromperia a leitura de mensagens antigas. */
export function shouldAutoScrollOnNewMessage({
  distanceFromBottomPx,
  isOwnMessage,
  thresholdPx = DEFAULT_NEAR_BOTTOM_THRESHOLD_PX,
}: ShouldAutoScrollInput): boolean {
  if (isOwnMessage) return true;
  return distanceFromBottomPx <= thresholdPx;
}

export type ComputeKeyboardInsetInput = {
  windowInnerHeight: number;
  visualViewportHeight: number;
  visualViewportOffsetTop?: number;
};

/** Altura real coberta pelo teclado on-screen (ou por qualquer outra
 * barra que reduza o `visualViewport`), a partir da diferença entre a
 * altura da janela e a altura visível de verdade -- substitui os
 * offsets fixos `94px`/`272px` chutados manualmente, que não reagem a
 * dispositivo/teclado/orientação diferentes do usado para calibrá-los. */
export function computeKeyboardInset({
  windowInnerHeight,
  visualViewportHeight,
  visualViewportOffsetTop = 0,
}: ComputeKeyboardInsetInput): number {
  const inset =
    windowInnerHeight - visualViewportHeight - visualViewportOffsetTop;
  return Math.max(0, inset);
}

/** `prefers-reduced-motion` já zera durações de transição/animação CSS
 * globalmente (`styles/globals.css`), mas `Element.scrollIntoView({behavior:
 * "smooth"})` é um parâmetro de JS, não CSS -- não é coberto por aquela
 * regra em todo navegador. Resolvido explicitamente aqui. */
export function resolveScrollBehavior(
  prefersReducedMotion: boolean
): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}
