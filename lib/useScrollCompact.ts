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
 * si só NÃO move o scroll. Antes o reset levava toda aba pro topo; agora
 * cada aba LEMBRA a própria rolagem (mapa resetKey → scrollY), como numa
 * tab bar nativa do iOS: sair da Agenda no meio da lista e voltar devolve
 * a lista no mesmo ponto. Aba nunca visitada abre no topo.
 *
 * A posição é gravada a cada evento de scroll do window (antes do
 * throttle por frame, pra última posição nunca se perder) sob a chave
 * ativa naquele momento. O efeito de reset roda em sincronia com o commit
 * do clique (efeito de evento discreto no React 18), antes do navegador
 * despachar o scroll "corrigido" da troca — então a posição da aba que
 * saiu nunca é sobrescrita pela altura da aba que entrou.
 */
export function useScrollCompact(resetKey?: unknown): boolean {
  const [compact, setCompact] = useState(false);
  const stateRef = useRef<ScrollCompactState>(INITIAL_SCROLL_COMPACT_STATE);
  const mountedRef = useRef(false);
  const keyRef = useRef<unknown>(resetKey);
  const positionsRef = useRef(new Map<unknown, number>());

  useEffect(() => {
    stateRef.current = INITIAL_SCROLL_COMPACT_STATE;
    setCompact(false);
    keyRef.current = resetKey;

    // Só reposiciona o scroll em trocas de aba de verdade — no mount
    // inicial não há "aba anterior" cuja rolagem precise ser corrigida.
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    // Sempre o window: é ele que rola o conteúdo das abas. Um alvo
    // interno (HTMLElement, ex. lista do chat) mantém o próprio scrollTop
    // sozinho — `display:none` não zera a rolagem de um elemento.
    // `behavior: "instant"` explícito — a troca de aba não é o tipo de
    // rolagem que deveria animar (a usuária já está olhando pro conteúdo
    // da aba nova; a rolagem só repõe a posição dela).
    const saved = positionsRef.current.get(resetKey) ?? 0;
    window.scrollTo({ top: saved, left: 0, behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    let frame: number | null = null;

    function handleScroll(e: Event) {
      const scrollTop = readScrollTop(e.target);
      if (scrollTop === null) return;
      if (e.target === window || e.target === document) {
        positionsRef.current.set(keyRef.current, scrollTop);
      }
      if (frame !== null) return;
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
