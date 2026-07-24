"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Casca de bottom-sheet única (overlay com blur + painel deslizante +
 * pega + cabeçalho com título e fechar). Unifica as cópias literais de
 * UploadSheet (Cofre) e PinSetup — o inventário apontou o mesmo shell
 * reinventado. O conteúdo e o rodapé são compostos por quem usa.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Rodapé fixo (ex.: botão de ação). Ganha borda superior. */
  footer?: ReactNode;
}

export function BottomSheet({ open, onClose, title, children, footer }: Props) {
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
        className="fixed left-0 right-0 z-[60] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: 0,
          transform: open ? "translateY(0)" : "translateY(105%)",
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
            className="p-1 mt-2 active:opacity-70"
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
