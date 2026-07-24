/**
 * Detecção de plataforma pro fluxo de instalação (§ tutorial de tela de
 * início) e pro gate de notificações no iOS — Safari só entrega push pra
 * PWA instalada (iOS 16.4+), nunca em aba comum.
 */

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se identifica como Mac, mas tem touch.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosStandalone === true
  );
}
