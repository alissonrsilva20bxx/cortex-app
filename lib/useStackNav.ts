"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  createDimLayer,
  createSnapshotLayer,
  type SnapshotLayer,
} from "@/lib/stackSnapshot";
import {
  SWIPE_BACK_EDGE,
  SWIPE_BACK_SLOP,
  shouldCompleteSwipeBack,
  shouldEngageSwipeBack,
} from "@/lib/swipeBack";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Curva e duração do push/pop — a mesma curva "iOS" dos sheets do app. */
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURATION = 420;
/** A tela de baixo anda só 30% da largura (parallax do UINavigationController). */
const PARALLAX = 0.3;
/** Opacidade máxima do véu escuro sobre a tela de baixo. */
const DIM = 0.22;
/** Camadas abaixo do FAB (z-40) e da BottomNav (z-50): a navegação continua por cima. */
const Z_UNDER = 30;
const Z_DIM = 31;
const Z_TOP = 32;

type Pending =
  | { kind: "push"; under: SnapshotLayer | null }
  | {
      kind: "pop";
      y: number;
      top: SnapshotLayer | null;
      under: SnapshotLayer | null;
    }
  | { kind: "swipe"; y: number; cleanup: () => void };

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * O arraste da borda só existe onde não briga com o "voltar" do próprio
 * navegador: no app instalado (standalone não tem gesto de histórico) e no
 * /dev-preview (pra testar no desktop). No Safari em aba, a borda esquerda
 * é do navegador.
 */
function swipeBackAvailable(): boolean {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.location.pathname.startsWith("/dev-preview");
}

function hasOpenDialog(): boolean {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[aria-modal="true"]')
  ).some((el) => getComputedStyle(el).visibility !== "hidden");
}

function translate(px: number): string {
  return `translate3d(${px}px, 0, 0)`;
}

/**
 * Pilha de telas com transições de navegação estilo iOS:
 *  - push: a tela nova entra pela direita por cima, a atual recua 30% e
 *    escurece;
 *  - pop (botão voltar / tocar de novo na aba): o inverso;
 *  - arrastar da borda esquerda: a tela de cima segue o dedo, e soltar
 *    decide (distância ou velocidade) se volta ou cancela.
 *
 * Cada nível guarda a própria rolagem: voltar devolve a tela de baixo no
 * mesmo ponto em que a pessoa a deixou, e uma tela nova abre no topo.
 *
 * Durante a animação as duas telas são clones estáticos (ver
 * lib/stackSnapshot.ts) e a tela viva fica `visibility:hidden` — por isso
 * `pageRef` precisa envolver SÓ as telas (sheets ficam fora). Sem
 * History API de propósito: um popstate sem o estado interno do App
 * Router recarrega a página no Next 14.
 */
export function useStackNav<T>(initial: T, active: boolean) {
  const [stack, setStack] = useState<T[]>(() => [initial]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const pageRef = useRef<HTMLDivElement>(null);
  /** Rolagem do window guardada por nível da pilha. */
  const scrolls = useRef<number[]>([]);
  /** Clone de cada nível tirado no push — vira o fundo do pop/arraste. */
  const unders = useRef<Array<SnapshotLayer | null>>([]);
  const pending = useRef<Pending | null>(null);
  /** Termina na hora a transição em curso (se houver). */
  const finishRunning = useRef<(() => void) | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const canAnimate = useCallback(
    () =>
      activeRef.current &&
      pageRef.current !== null &&
      typeof pageRef.current.animate === "function" &&
      !prefersReducedMotion(),
    []
  );

  const dropUndersFrom = useCallback((level: number) => {
    unders.current.slice(level).forEach((layer) => layer?.unmount());
    unders.current.length = Math.min(unders.current.length, level);
    scrolls.current.length = Math.min(scrolls.current.length, level);
  }, []);

  const push = useCallback(
    (screen: T) => {
      finishRunning.current?.();
      const level = stackRef.current.length - 1;
      scrolls.current[level] = window.scrollY;
      const under =
        canAnimate() && pageRef.current
          ? createSnapshotLayer(pageRef.current, false)
          : null;
      unders.current[level]?.unmount();
      unders.current[level] = under;
      pending.current = { kind: "push", under };
      setStack((prev) => [...prev, screen]);
    },
    [canAnimate]
  );

  const popTo = useCallback(
    (length: number, toTop = false) => {
      finishRunning.current?.();
      if (length < 1 || length >= stackRef.current.length) return;
      const target = length - 1;
      const top =
        canAnimate() && pageRef.current
          ? createSnapshotLayer(pageRef.current, true)
          : null;
      // Indo pro topo, o clone guardado (tirado noutra rolagem) não casaria
      // com a tela viva: anima só a de cima saindo, com a viva por baixo.
      const under = top && !toTop ? (unders.current[target] ?? null) : null;
      const y = toTop ? 0 : (scrolls.current[target] ?? 0);
      if (under) unders.current[target] = null;
      dropUndersFrom(target);
      pending.current = { kind: "pop", y, top, under };
      setStack((prev) => prev.slice(0, length));
    },
    [canAnimate, dropUndersFrom]
  );

  const pop = useCallback(() => popTo(stackRef.current.length - 1), [popTo]);
  const popToRoot = useCallback(
    (opts?: { toTop?: boolean }) => popTo(1, opts?.toTop ?? false),
    [popTo]
  );

  function runTransition(
    layers: SnapshotLayer[],
    dim: HTMLElement,
    keyframes: Array<[Element, Keyframe[]]>,
    hideLive: boolean
  ) {
    const page = pageRef.current;
    if (hideLive && page) page.style.visibility = "hidden";
    let done = false;
    const anims = keyframes.map(([el, frames]) =>
      el.animate(frames, { duration: DURATION, easing: EASE, fill: "forwards" })
    );
    const finish = () => {
      if (done) return;
      done = true;
      anims.forEach((a) => a.cancel());
      layers.forEach((l) => l.unmount());
      dim.remove();
      if (page) page.style.visibility = "";
      if (finishRunning.current === finish) finishRunning.current = null;
    };
    anims[0].onfinish = finish;
    finishRunning.current = finish;
  }

  useIsomorphicLayoutEffect(() => {
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    const w = window.innerWidth;

    if (p.kind === "swipe") {
      window.scrollTo({ top: p.y, left: 0, behavior: "instant" });
      p.cleanup();
      return;
    }

    if (p.kind === "push") {
      // Tela nova sempre abre no topo (o chat rola pro fim sozinho logo
      // depois, no efeito dele).
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      const under = p.under;
      const page = pageRef.current;
      if (!under || !page) return;
      page.style.visibility = "hidden";
      under.mount(Z_UNDER);
      const dim = createDimLayer(Z_DIM);
      // A tela nova só é clonada no próximo frame (ainda antes do paint):
      // os efeitos dela — ex. o chat rolando até a última mensagem — rodam
      // depois deste layout effect.
      let cancelled = false;
      const frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const top = createSnapshotLayer(page, true);
        top.el.classList.add("stack-snapshot--top");
        top.mount(Z_TOP);
        runTransition(
          [top, under],
          dim,
          [
            [
              top.el,
              [{ transform: translate(w) }, { transform: translate(0) }],
            ],
            [
              under.el,
              [
                { transform: translate(0) },
                { transform: translate(-w * PARALLAX) },
              ],
            ],
            [dim, [{ opacity: 0 }, { opacity: DIM }]],
          ],
          true
        );
        // `unmount` no fim só tira o clone de baixo do DOM — ele continua
        // guardado em `unders` como fundo do pop/arraste desta tela.
      });
      finishRunning.current = () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        under.unmount();
        dim.remove();
        page.style.visibility = "";
        finishRunning.current = null;
      };
      return;
    }

    // pop
    window.scrollTo({ top: p.y, left: 0, behavior: "instant" });
    if (!p.top) return;
    const layers: SnapshotLayer[] = [p.top];
    const frames: Array<[Element, Keyframe[]]> = [
      [p.top.el, [{ transform: translate(0) }, { transform: translate(w) }]],
    ];
    if (p.under) {
      p.under.mount(Z_UNDER);
      layers.push(p.under);
      frames.push([
        p.under.el,
        [{ transform: translate(-w * PARALLAX) }, { transform: translate(0) }],
      ]);
    }
    const dim = createDimLayer(Z_DIM);
    frames.push([dim, [{ opacity: DIM }, { opacity: 0 }]]);
    p.top.el.classList.add("stack-snapshot--top");
    p.top.mount(Z_TOP);
    runTransition(layers, dim, frames, p.under !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack]);

  // Trocar de aba no meio de uma transição: termina na hora (as camadas são
  // `fixed` e ficariam por cima da outra aba).
  useEffect(() => {
    if (!active) finishRunning.current?.();
  }, [active]);

  useEffect(
    () => () => {
      finishRunning.current?.();
      unders.current.forEach((layer) => layer?.unmount());
    },
    []
  );

  // ── Arrastar da borda esquerda pra voltar ──
  const depth = stack.length;
  useEffect(() => {
    if (!active || depth < 2 || !swipeBackAvailable()) return;

    interface Gesture {
      x0: number;
      y0: number;
      dx: number;
      samples: Array<[number, number]>;
      engaged: boolean;
      top?: SnapshotLayer;
      under?: SnapshotLayer;
      dim?: HTMLElement;
    }
    let g: Gesture | null = null;

    function apply(gesture: Gesture, dx: number) {
      const w = window.innerWidth;
      const p = Math.min(1, Math.max(0, dx / w));
      gesture.top!.el.style.transform = translate(p * w);
      gesture.under!.el.style.transform = translate(-w * PARALLAX * (1 - p));
      gesture.dim!.style.opacity = String(DIM * (1 - p));
    }

    function cleanupGesture(gesture: Gesture) {
      gesture.top?.unmount();
      // Só sai do DOM: o clone de baixo segue guardado em `unders` se o
      // gesto foi cancelado (a tela de cima continua na pilha).
      gesture.under?.unmount();
      gesture.dim?.remove();
      if (pageRef.current) pageRef.current.style.visibility = "";
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1 || finishRunning.current) return;
      const t = e.touches[0];
      if (t.clientX > SWIPE_BACK_EDGE) return;
      const page = pageRef.current;
      if (!page || !(e.target instanceof Node)) return;
      // A faixa da borda quase nunca cai DENTRO da tela: o `<main>` tem
      // `px-4`, então os primeiros 16px são padding dele. Vale tocar na
      // tela ou num ancestral dela (main/body) — não em camadas irmãs como
      // a BottomNav, o FAB ou um sheet.
      if (!page.contains(e.target) && !e.target.contains(page)) return;
      if (hasOpenDialog()) return;
      g = {
        x0: t.clientX,
        y0: t.clientY,
        dx: 0,
        samples: [[e.timeStamp, t.clientX]],
        engaged: false,
      };
    }

    function onMove(e: TouchEvent) {
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (!g.engaged) {
        if (!shouldEngageSwipeBack(dx, dy)) {
          // Ainda dentro da folga: espera mais movimento. Fora dela e não
          // horizontal pra direita: é rolagem, larga o gesto.
          if (
            Math.abs(dx) >= SWIPE_BACK_SLOP ||
            Math.abs(dy) >= SWIPE_BACK_SLOP
          ) {
            g = null;
          }
          return;
        }
        const level = stackRef.current.length - 2;
        const under = unders.current[level];
        const page = pageRef.current;
        if (!under || !page) {
          g = null;
          return;
        }
        g.engaged = true;
        g.under = under;
        g.top = createSnapshotLayer(page, true);
        g.top.el.classList.add("stack-snapshot--top");
        under.mount(Z_UNDER);
        g.dim = createDimLayer(Z_DIM);
        g.top.mount(Z_TOP);
        page.style.visibility = "hidden";
      }
      if (e.cancelable) e.preventDefault();
      g.dx = dx;
      g.samples.push([e.timeStamp, t.clientX]);
      if (g.samples.length > 6) g.samples.shift();
      apply(g, dx);
    }

    function onEnd(e: TouchEvent) {
      const gesture = g;
      g = null;
      if (!gesture?.engaged) return;
      const w = window.innerWidth;
      const [t0, x0] = gesture.samples[0];
      const [t1, x1] = gesture.samples[gesture.samples.length - 1];
      const velocity = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
      const complete =
        e.type === "touchend" &&
        shouldCompleteSwipeBack(gesture.dx, w, velocity);
      const p = Math.min(1, Math.max(0, gesture.dx / w));
      const remaining = complete ? 1 - p : p;
      const duration = Math.max(160, Math.round(DURATION * 0.8 * remaining));
      const opts: KeyframeAnimationOptions = {
        duration,
        easing: EASE,
        fill: "forwards",
      };
      const anims = [
        gesture.top!.el.animate(
          [{ transform: translate(complete ? w : 0) }],
          opts
        ),
        gesture.under!.el.animate(
          [{ transform: translate(complete ? 0 : -w * PARALLAX) }],
          opts
        ),
        gesture.dim!.animate([{ opacity: complete ? 0 : DIM }], opts),
      ];
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (finishRunning.current === finish) finishRunning.current = null;
        if (!complete) {
          anims.forEach((a) => a.cancel());
          cleanupGesture(gesture);
          return;
        }
        // Completa: tira a tela do topo da pilha e, no MESMO commit (layout
        // effect, antes do paint), repõe a rolagem da tela de baixo e
        // remove as camadas — sem um frame da tela viva fora do lugar.
        const target = stackRef.current.length - 2;
        const y = scrolls.current[target] ?? 0;
        unders.current[target] = null;
        dropUndersFrom(target);
        pending.current = {
          kind: "swipe",
          y,
          cleanup: () => {
            anims.forEach((a) => a.cancel());
            cleanupGesture(gesture);
          },
        };
        flushSync(() => setStack((prev) => prev.slice(0, -1)));
      };
      anims[0].onfinish = finish;
      finishRunning.current = finish;
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
      if (g?.engaged) cleanupGesture(g);
      g = null;
    };
  }, [active, depth, dropUndersFrom]);

  return {
    stack,
    screen: stack[stack.length - 1],
    pageRef,
    push,
    pop,
    popToRoot,
  };
}
