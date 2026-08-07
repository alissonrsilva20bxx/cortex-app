"use client";

import { useEffect, useRef, useState } from "react";
import {
  INITIAL_SCROLL_COMPACT_STATE,
  nextScrollCompactState,
  type ScrollCompactState,
} from "@/lib/scrollCompact";

function readScrollTop(target: EventTarget | null): number | null {
  if (target === window || target === document) return window.scrollY;
  if (target instanceof HTMLElement) return target.scrollTop;
  return null;
}

/**
 * Detecta a direção de rolagem para compactar/expandir a BottomNav. O app
 * não rola via `window` — o conteúdo mora dentro de um `<main
 * overflow-y-auto>` (e telas como o chat da Rede têm suas próprias listas
 * roláveis). `scroll` não borbulha, mas ainda é entregue a listeners em
 * fase de captura de qualquer ancestral — por isso ouvimos no `document`
 * com `capture: true` em vez de assumir qual elemento rola.
 *
 * `resetKey` (normalmente a aba ativa) zera compact + baseline quando muda,
 * pra troca de aba nunca herdar um estado de rolagem de outra tela.
 */
export function useScrollCompact(resetKey?: unknown): boolean {
  const [compact, setCompact] = useState(false);
  const stateRef = useRef<ScrollCompactState>(INITIAL_SCROLL_COMPACT_STATE);

  useEffect(() => {
    stateRef.current = INITIAL_SCROLL_COMPACT_STATE;
    setCompact(false);
  }, [resetKey]);

  useEffect(() => {
    let frame: number | null = null;

    function handleScroll(e: Event) {
      const scrollTop = readScrollTop(e.target);
      if (scrollTop === null || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const next = nextScrollCompactState(stateRef.current, scrollTop);
        stateRef.current = next;
        setCompact((prev) => (prev === next.compact ? prev : next.compact));
      });
    }

    document.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return compact;
}
