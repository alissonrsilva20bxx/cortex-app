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
 * Detecta a direção de rolagem para compactar/expandir a BottomNav. `main`
 * tem `overflow-y-auto`, mas fica dentro de um container só com
 * `min-h-screen` (não `h-screen`) — na prática `main` nunca fica mais baixo
 * que o próprio conteúdo, então quem rola de verdade é o `document`/
 * `window` (confirmado via Playwright em T14/#67). Telas com lista própria
 * (chat da Rede) ainda podem rolar num elemento interno, então o código
 * segue tratando os dois casos. `scroll` não borbulha, mas ainda é
 * entregue a listeners em fase de captura de qualquer ancestral — por isso
 * ouvimos no `document` com `capture: true` em vez de assumir qual
 * elemento rola.
 *
 * `resetKey` (normalmente a aba ativa) zera compact + baseline quando muda,
 * pra troca de aba nunca herdar um estado de rolagem de outra tela. Como
 * quem rola de fato é o document/window (não um `<main>` próprio por aba —
 * `TabPanel` mantém todas montadas com `display:none`), trocar de aba por
 * si só NÃO move o scroll: a pílula reexpande (compact reseta) mas a
 * aba nova pode abrir no meio do conteúdo em vez do topo. Por isso o mesmo
 * reset também leva o scroll de volta pro topo do alvo mais recente
 * conhecido — sem isso a pílula "mente" que a tela está no topo.
 */
export function useScrollCompact(resetKey?: unknown): boolean {
  const [compact, setCompact] = useState(false);
  const stateRef = useRef<ScrollCompactState>(INITIAL_SCROLL_COMPACT_STATE);
  const scrollTargetRef = useRef<EventTarget | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    stateRef.current = INITIAL_SCROLL_COMPACT_STATE;
    setCompact(false);

    // Só reposiciona o scroll em trocas de aba de verdade — no mount
    // inicial não há "aba anterior" cuja rolagem precise ser corrigida.
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const target = scrollTargetRef.current;
    if (target === window || target === document) {
      // `behavior: "instant"` explícito — `globals.css` liga
      // `scroll-behavior: smooth` na página inteira, e uma troca de aba
      // não é o tipo de rolagem que deveria animar (a usuária já está
      // olhando pro conteúdo da aba nova; a rolagem só corrige a posição).
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } else if (target instanceof HTMLElement) {
      target.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    let frame: number | null = null;

    function handleScroll(e: Event) {
      const scrollTop = readScrollTop(e.target);
      if (scrollTop === null || frame !== null) return;
      scrollTargetRef.current = e.target;
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
