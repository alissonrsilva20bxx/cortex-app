import { useEffect, useRef } from "react";

export const DESEJOS_MUDARAM = "jobapp:desejos-mudaram";

/** Quem grava Desejo (criar, editar, excluir, guardar) chama isto. */
export function avisarDesejosMudaram(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DESEJOS_MUDARAM));
}

/** Quem mostra Desejo recarrega quando alguém avisa que mudou. */
export function useAoMudarDesejos(cb: () => void): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const ouvir = () => ref.current();
    window.addEventListener(DESEJOS_MUDARAM, ouvir);
    return () => window.removeEventListener(DESEJOS_MUDARAM, ouvir);
  }, []);
}
