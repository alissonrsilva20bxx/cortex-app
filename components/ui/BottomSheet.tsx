"use client";

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { getFocusCycleTarget } from "./focusTrap";
import { rubberBandSheet, shouldDismissSheet } from "@/lib/sheetDrag";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

// O véu aparece/some em fade junto com o painel (antes surgia e sumia
// seco, num frame) — `visibility` só desliga depois do fade de saída.
function backdropTransition(open: boolean) {
  return open
    ? `opacity 300ms ${EASE}, visibility 0s linear 0s`
    : `opacity 300ms ${EASE}, visibility 0s linear 300ms`;
}

interface DragState {
  id: number;
  startY: number;
  dy: number;
  samples: Array<{ t: number; y: number }>;
}

/**
 * Casca de bottom-sheet única (overlay com blur + painel deslizante +
 * pega + cabeçalho com título e fechar). Unifica as cópias literais de
 * UploadSheet (Cofre) e PinSetup — o inventário apontou o mesmo shell
 * reinventado. O conteúdo e o rodapé são compostos por quem usa.
 *
 * Focus trap / role="dialog" / Esc / restauração de foco (T6 — relatório
 * de paridade do Gate da Rede, achado P1-3): nenhum dos ~18 consumidores
 * deste shell tinha isso — corrigido aqui na causa-raiz, a partir da
 * implementação de referência do laboratório
 * (`NetworkGateScreen.tsx:80-116`), não como patch local de um sheet só.
 * Aditivo por natureza (nenhum consumidor dependia de Tab escapando do
 * sheet ou de Esc fazendo algo específico — comportamento uniformemente
 * ausente antes, não uma variação intencional entre consumidores), então
 * aplicado como padrão pra todos, sem prop opt-in (diferente do
 * `largeCloseTarget` abaixo, que é puramente visual/dimensional).
 */

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Rodapé fixo (ex.: botão de ação). Ganha borda superior. */
  footer?: ReactNode;
  /**
   * Alvo de toque mínimo de 44×44px no botão fechar (relatório de
   * paridade do Cofre, achado P1-5 — o botão media ~28×28px). Omitido/
   * false preserva o tamanho original, sem regredir os outros 18
   * consumidores deste shell (Rede, PinSetup, RecapSheet…), fora do
   * escopo deste ticket. Só o Cofre (`UploadSheet`) passa `true`.
   */
  largeCloseTarget?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  largeCloseTarget = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  // `onClose` chega como closure nova a cada render em vários consumidores
  // (ex.: PostComposer embrulha onClose num `() => { reset(); onClose(); }`
  // inline) -- se o efeito abaixo dependesse de `onClose` direto, cada
  // keystroke que re-renderiza o consumidor reexecutaria o efeito inteiro,
  // roubando o foco do campo de volta pro botão "Fechar" (fecha o teclado
  // no celular a cada tecla, achado real em produção 2026-09-08). Ref
  // sempre atual em vez de dependência evita isso sem mudar o
  // comportamento do handler.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    function focusable() {
      return Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    }
    focusable()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const target = getFocusCycleTarget(
        items,
        document.activeElement as HTMLElement | null,
        event.shiftKey
      );
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Arrastar pra baixo pela pega/cabeçalho fecha o sheet, como no iOS: o
  // painel segue o dedo 1:1 (com resistência pra cima), o véu clareia na
  // mesma proporção, e ao soltar decide por distância (25% da altura) ou
  // velocidade (flick). Mexe direto no estilo do DOM durante o gesto —
  // passar por estado do React a cada pointermove re-renderizaria o
  // conteúdo inteiro do sheet a 120Hz. Só o cabeçalho arrasta: o corpo
  // pode ter lista rolável/campos e não deve brigar com isso.
  function handleDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const panel = panelRef.current;
    if (!panel) return;
    dragRef.current = {
      id: e.pointerId,
      startY: e.clientY,
      dy: 0,
      samples: [{ t: e.timeStamp, y: e.clientY }],
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    panel.style.transitionProperty = "none";
    if (backdropRef.current) backdropRef.current.style.transition = "none";
  }

  function handleDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.id !== e.pointerId || !panel) return;
    drag.dy = rubberBandSheet(e.clientY - drag.startY);
    drag.samples.push({ t: e.timeStamp, y: e.clientY });
    if (drag.samples.length > 6) drag.samples.shift();
    panel.style.transform = `translateY(${drag.dy}px)`;
    if (backdropRef.current) {
      const progress = Math.max(0, drag.dy) / (panel.offsetHeight || 1);
      backdropRef.current.style.opacity = String(1 - progress);
    }
  }

  function handleDragEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.id !== e.pointerId || !panel) return;
    dragRef.current = null;
    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    const velocity = (last.y - first.y) / Math.max(1, last.t - first.t);
    const dismiss =
      e.type === "pointerup" &&
      shouldDismissSheet(drag.dy, panel.offsetHeight, velocity);

    panel.style.transitionProperty = "transform, visibility";
    const backdrop = backdropRef.current;
    if (backdrop) backdrop.style.transition = backdropTransition(true);

    function snapBack() {
      if (!panel) return;
      panel.style.transform = "translateY(0)";
      if (backdrop) backdrop.style.opacity = "1";
    }

    if (!dismiss) {
      snapBack();
      return;
    }
    // Deixa o painel onde o dedo soltou: o React troca o transform pra
    // fora da tela no próximo render e a transição parte daqui. Se quem
    // usa o sheet recusar fechar (ex.: confirmar descarte), volta.
    onCloseRef.current();
    requestAnimationFrame(() => {
      if (openRef.current) snapBack();
    });
  }

  return (
    <>
      {/* Fundação Visual (#142): `.sheetBackdrop` do protótipo escurece com
          preto puro semi-opaco, sem borrar o conteúdo atrás -- o blur(6px)
          + tinta do tema aqui era uma composição que o protótipo não tem
          (ver docs/visual/IOS_VISUAL_SYSTEM.md, seção "Sheets"). */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="fixed inset-0 z-[60]"
        style={{
          background: "rgba(0, 0, 0, 0.62)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
          transition: backdropTransition(open),
        }}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed left-0 right-0 z-[60] flex flex-col ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: 0,
          transform: open ? "translateY(0)" : "translateY(105%)",
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
          transitionProperty: "transform, visibility",
          transitionDuration: "300ms, 0s",
          transitionDelay: open ? "0s, 0s" : "0s, 300ms",
          // Fundação Visual (#142): `.sheet` do protótipo é opaco (gradiente
          // sobre o próprio --bg do tema), sem backdrop-filter -- var(--surface-2)
          // sozinho é quase transparente (ex. rgba(255,255,255,0.07) no
          // grafite) e só "funcionava" visualmente por causa do blur(24px)
          // que simulava vidro fosco. Gradiente análogo ao do protótipo
          // (linear-gradient(180deg, #220b14, #12040a 70%)), portado pro
          // --bg de cada tema.
          background: `linear-gradient(180deg, rgb(var(--bg-rgb) / 0.97), rgb(var(--bg-rgb) / 0.995) 70%)`,
          border: "1px solid var(--card-border)",
          borderBottom: "none",
          borderTopLeftRadius: "var(--radius-sheet)",
          borderTopRightRadius: "var(--radius-sheet)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Cabeçalho + pega */}
        <div
          className="relative flex items-center justify-between px-5 pt-4 pb-3 shrink-0"
          style={{
            borderBottom: "1px solid var(--border-color)",
            touchAction: "none",
          }}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div
            className="w-9 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-3"
            style={{ background: "var(--border-color)" }}
          />
          <p
            className="font-semibold text-base mt-2"
            style={{ color: "var(--text)" }}
          >
            {title}
          </p>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className={
              largeCloseTarget
                ? "flex items-center justify-center active:opacity-70"
                : "p-1 mt-2 active:opacity-70"
            }
            style={largeCloseTarget ? { width: 44, height: 44 } : undefined}
          >
            <X size={20} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {children}

        {footer && (
          <div
            className="px-5 py-4 shrink-0"
            style={{ borderTop: "1px solid var(--border-color)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
