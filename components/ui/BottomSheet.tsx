"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { getFocusCycleTarget } from "./focusTrap";

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

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60]"
          style={{
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            background: "rgb(var(--bg-rgb) / 0.55)",
          }}
          onClick={onClose}
        />
      )}

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
          background: "var(--surface-2)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid var(--border-color)",
          borderBottom: "none",
          borderTopLeftRadius: "var(--radius-xl)",
          borderTopRightRadius: "var(--radius-xl)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Cabeçalho + pega */}
        <div
          className="relative flex items-center justify-between px-5 pt-4 pb-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)" }}
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
