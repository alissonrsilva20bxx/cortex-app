"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";

/**
 * Puxar pra atualizar, estilo Instagram. A rolagem de verdade é a do
 * `window` (o <main> nunca overflow-a), então só engata quando a página
 * já está no topo (`scrollY <= 0`) e o gesto é vertical pra baixo --
 * gesto horizontal (voltar arrastando da borda) passa reto.
 *
 * O `html` tem `overscroll-behavior-y: none` (sem elástico nativo), então
 * este é o único "puxão" no topo. O `transform` só existe enquanto puxa:
 * parado, nada de containing block novo pra filhos `position: fixed`.
 */

const LIMIAR = 70; // px (já com resistência) pra disparar
const ALTURA_CARREGANDO = 56;
const MAX = 110;
const TIMEOUT_MS = 12_000;

interface Props {
  onRefresh: () => Promise<unknown>;
  disabled?: boolean;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, disabled, children }: Props) {
  const raizRef = useRef<HTMLDivElement>(null);
  const [puxado, setPuxado] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  // Sem transform em repouso (só volta a `none` depois da animação de
  // retorno terminar, senão o conteúdo pularia pro topo sem animar).
  const [repouso, setRepouso] = useState(true);

  // Refs pros handlers nativos (registrados uma vez, com passive: false).
  const estado = useRef({
    inicioX: 0,
    inicioY: 0,
    modo: "nada" as "nada" | "decidindo" | "puxando" | "ignorar",
    puxado: 0,
  });
  const atualizandoRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    const el = raizRef.current;
    if (!el) return;

    function aoTocar(e: TouchEvent) {
      const s = estado.current;
      if (
        disabledRef.current ||
        atualizandoRef.current ||
        e.touches.length !== 1 ||
        window.scrollY > 0
      ) {
        s.modo = "ignorar";
        return;
      }
      s.inicioX = e.touches[0].clientX;
      s.inicioY = e.touches[0].clientY;
      s.modo = "decidindo";
      s.puxado = 0;
    }

    function aoMover(e: TouchEvent) {
      const s = estado.current;
      if (s.modo === "nada" || s.modo === "ignorar") return;
      const dx = e.touches[0].clientX - s.inicioX;
      const dy = e.touches[0].clientY - s.inicioY;
      if (s.modo === "decidindo") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) && window.scrollY <= 0) {
          s.modo = "puxando";
          setArrastando(true);
          setRepouso(false);
        } else {
          s.modo = "ignorar";
          return;
        }
      }
      // puxando
      if (e.cancelable) e.preventDefault();
      const d = Math.max(0, dy);
      // Resistência: anda metade do dedo, com teto.
      s.puxado = Math.min(MAX, d * 0.5);
      setPuxado(s.puxado);
    }

    function aoSoltar() {
      const s = estado.current;
      const estavaPuxando = s.modo === "puxando";
      s.modo = "nada";
      if (!estavaPuxando) return;
      setArrastando(false);
      if (s.puxado < LIMIAR) {
        // Sem deslocamento não há transição pra encerrar o transform.
        if (s.puxado === 0) setRepouso(true);
        setPuxado(0);
        return;
      }
      atualizandoRef.current = true;
      setAtualizando(true);
      setPuxado(ALTURA_CARREGANDO);
      navigator.vibrate?.(10);
      const timeout = new Promise((r) => setTimeout(r, TIMEOUT_MS));
      Promise.race([onRefreshRef.current(), timeout])
        .catch(() => {})
        .finally(() => {
          atualizandoRef.current = false;
          setAtualizando(false);
          setPuxado(0);
        });
    }

    el.addEventListener("touchstart", aoTocar, { passive: true });
    el.addEventListener("touchmove", aoMover, { passive: false });
    el.addEventListener("touchend", aoSoltar, { passive: true });
    el.addEventListener("touchcancel", aoSoltar, { passive: true });
    return () => {
      el.removeEventListener("touchstart", aoTocar);
      el.removeEventListener("touchmove", aoMover);
      el.removeEventListener("touchend", aoSoltar);
      el.removeEventListener("touchcancel", aoSoltar);
    };
  }, []);

  const pronto = puxado >= LIMIAR;
  const progresso = Math.min(1, puxado / LIMIAR);
  const transicao = arrastando
    ? "none"
    : "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)";

  return (
    <div ref={raizRef} className="relative">
      <div
        aria-hidden={!atualizando}
        className="absolute left-0 right-0 flex justify-center pointer-events-none"
        style={{
          top: 0,
          height: ALTURA_CARREGANDO,
          alignItems: "center",
          opacity: atualizando ? 1 : progresso,
          transform: `translateY(${puxado - ALTURA_CARREGANDO}px)`,
          transition: arrastando
            ? "none"
            : "transform 260ms ease, opacity 200ms",
        }}
      >
        <span
          role={atualizando ? "status" : undefined}
          aria-label={atualizando ? "Atualizando" : undefined}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 34,
            height: 34,
            background: "var(--surface-2)",
            border: "1px solid var(--border-color)",
            color: "var(--accent)",
          }}
        >
          {atualizando ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <ArrowDown
              size={17}
              style={{
                transform: `rotate(${pronto ? 180 : 0}deg)`,
                transition: "transform 160ms",
              }}
            />
          )}
        </span>
      </div>
      <div
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && puxado === 0) setRepouso(true);
        }}
        style={{
          transform: repouso ? undefined : `translateY(${puxado}px)`,
          transition: transicao,
        }}
      >
        {children}
      </div>
    </div>
  );
}
