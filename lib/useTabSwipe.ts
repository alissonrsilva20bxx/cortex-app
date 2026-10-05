"use client";

import { useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { TabId } from "@/lib/types";
import {
  TAB_SWIPE_EDGE,
  TAB_SWIPE_SLOP,
  neighborTab,
  shouldCompleteTabSwipe,
  shouldEngageTabSwipe,
} from "@/lib/tabSwipe";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Elementos em que um arraste horizontal já tem dono: campos de texto,
 * gráficos, carrosséis e qualquer área marcada `data-no-tab-swipe` (ex.: a
 * Rede com uma subtela aberta, onde arrastar é "voltar").
 */
const OWNED =
  'input, textarea, select, [contenteditable="true"], .recharts-wrapper, [data-no-tab-swipe]';

/**
 * Algum sheet/diálogo aberto de verdade? Os forms "artesanais" (JobForm,
 * DespesaForm...) ficam sempre montados com `aria-modal`, só empurrados pra
 * fora da tela -- então conta só o que está visível E dentro da viewport.
 */
function hasOpenDialog(): boolean {
  const h = window.innerHeight;
  return Array.from(
    document.querySelectorAll<HTMLElement>('[aria-modal="true"]')
  ).some((el) => {
    if (getComputedStyle(el).visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.top < h - 1 && r.bottom > 1;
  });
}

/** Algum ancestral (até o container) rola na horizontal? Então o arraste é dele. */
function insideHorizontalScroller(target: Element, root: Element): boolean {
  let el: Element | null = target;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Arrastar o dedo pro lado troca de aba (Início ↔ Agenda ↔ Financeiro ↔
 * Cofre ↔ Rede). O conteúdo da aba segue o dedo com resistência; soltar
 * decide (distância ou velocidade) se troca ou volta pro lugar. Nas pontas
 * (Início pra direita, Rede pra esquerda) só estica um pouco e volta.
 *
 * O painel anda com `position: relative; left` e não com `transform`: um
 * `transform` vira o bloco de contenção dos descendentes `position: fixed`
 * (composer do chat, sheets) e eles pulariam de lugar durante o gesto.
 *
 * Painéis são os filhos do container com `data-tab-panel` (ver TabPanel).
 */
export function useTabSwipe({
  containerRef,
  activeTab,
  enabled,
  onChange,
}: {
  containerRef: RefObject<HTMLElement>;
  activeTab: TabId;
  enabled: boolean;
  onChange: (tab: TabId) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const root = containerRef.current;
    if (!enabled || !root) return;

    interface Gesture {
      x0: number;
      y0: number;
      dx: number;
      engaged: boolean;
      next: TabId | null;
      panel: HTMLElement | null;
      samples: Array<[number, number]>;
    }
    let g: Gesture | null = null;
    let busy = false;

    const panelOf = (tab: TabId) =>
      root.querySelector<HTMLElement>(`[data-tab-panel="${tab}"]`);

    function offsetFor(gesture: Gesture, dx: number): number {
      // Sem vizinha naquela direção: só um "elástico" curto.
      if (!neighborTab(activeTab, dx)) {
        return Math.sign(dx) * Math.min(36, Math.abs(dx) * 0.15);
      }
      return dx * 0.6;
    }

    function place(panel: HTMLElement, left: number, opacity: number) {
      panel.style.position = "relative";
      panel.style.left = `${left}px`;
      panel.style.opacity = String(opacity);
    }

    function reset(panel: HTMLElement) {
      panel.getAnimations().forEach((a) => a.cancel());
      panel.style.position = "";
      panel.style.left = "";
      panel.style.opacity = "";
    }

    function onStart(e: TouchEvent) {
      if (busy || e.touches.length !== 1) return;
      const t = e.touches[0];
      const w = window.innerWidth;
      if (t.clientX < TAB_SWIPE_EDGE || t.clientX > w - TAB_SWIPE_EDGE) return;
      const target = e.target;
      if (!(target instanceof Element) || !root!.contains(target)) return;
      if (target.closest(OWNED)) return;
      if (insideHorizontalScroller(target, root!)) return;
      if (hasOpenDialog()) return;
      g = {
        x0: t.clientX,
        y0: t.clientY,
        dx: 0,
        engaged: false,
        next: null,
        panel: null,
        samples: [[e.timeStamp, t.clientX]],
      };
    }

    function onMove(e: TouchEvent) {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (!g.engaged) {
        if (!shouldEngageTabSwipe(dx, dy)) {
          if (
            Math.abs(dx) >= TAB_SWIPE_SLOP ||
            Math.abs(dy) >= TAB_SWIPE_SLOP
          ) {
            g = null; // virou rolagem vertical
          }
          return;
        }
        const panel = panelOf(activeTab);
        if (!panel) {
          g = null;
          return;
        }
        g.engaged = true;
        g.panel = panel;
        panel.getAnimations().forEach((a) => a.cancel());
      }
      if (e.cancelable) e.preventDefault();
      g.dx = dx;
      g.samples.push([e.timeStamp, t.clientX]);
      if (g.samples.length > 6) g.samples.shift();
      const left = offsetFor(g, dx);
      const fade = neighborTab(activeTab, dx)
        ? 1 - Math.min(0.4, (Math.abs(dx) / window.innerWidth) * 0.6)
        : 1;
      place(g.panel!, left, fade);
    }

    function onEnd(e: TouchEvent) {
      const gesture = g;
      g = null;
      if (!gesture?.engaged || !gesture.panel) return;
      const panel = gesture.panel;
      const w = window.innerWidth;
      const [t0, x0] = gesture.samples[0];
      const [t1, x1] = gesture.samples[gesture.samples.length - 1];
      const velocity = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
      const next = neighborTab(activeTab, gesture.dx);
      const complete =
        e.type === "touchend" &&
        next !== null &&
        shouldCompleteTabSwipe(gesture.dx, w, velocity);

      const fromLeft = parseFloat(panel.style.left) || 0;
      const fromOpacity = parseFloat(panel.style.opacity) || 1;

      if (!complete || !next) {
        // Volta pro lugar.
        busy = true;
        const anim = panel.animate(
          [
            { left: `${fromLeft}px`, opacity: fromOpacity },
            { left: "0px", opacity: 1 },
          ],
          { duration: 260, easing: EASE }
        );
        place(panel, 0, 1);
        anim.onfinish = anim.oncancel = () => {
          busy = false;
          reset(panel);
        };
        return;
      }

      const dir = Math.sign(gesture.dx); // -1 = foi pra próxima
      busy = true;
      const reduce = prefersReducedMotion();
      const out = panel.animate(
        [
          { left: `${fromLeft}px`, opacity: fromOpacity },
          { left: `${dir * w * 0.3}px`, opacity: 0 },
        ],
        { duration: reduce ? 0 : 120, easing: "ease-in", fill: "forwards" }
      );
      out.onfinish = () => {
        reset(panel);
        flushSync(() => onChangeRef.current(next));
        const incoming = panelOf(next);
        if (!incoming || reduce) {
          busy = false;
          return;
        }
        place(incoming, -dir * w * 0.22, 0);
        const inn = incoming.animate(
          [
            { left: `${-dir * w * 0.22}px`, opacity: 0 },
            { left: "0px", opacity: 1 },
          ],
          { duration: 300, easing: EASE }
        );
        place(incoming, 0, 1);
        inn.onfinish = inn.oncancel = () => {
          busy = false;
          reset(incoming);
        };
      };
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      if (g?.panel) reset(g.panel);
      g = null;
    };
  }, [containerRef, activeTab, enabled]);
}
