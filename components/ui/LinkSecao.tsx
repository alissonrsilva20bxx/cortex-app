"use client";

import type { ReactNode } from "react";

/** Altura da linha do texto do link: 12px × line-height 1,5. */
const ALTURA_TEXTO = 18;
const ALVO_MINIMO = 44;

/**
 * Link de seção do mockup normativo ("Agenda ›" no Início, "Extrato ›" no
 * Financeiro): 12px/700 em `--t-deep`, sem fundo. O desenho é o do mockup;
 * o toque é de 44×44 (mínimo do app), com margem negativa pra linha do
 * título não crescer -- mesmo molde das peças de components/ui/cabecalho.
 */
export function LinkSecao({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: `${ALVO_MINIMO}px`,
        minWidth: `${ALVO_MINIMO}px`,
        margin: `-${(ALVO_MINIMO - ALTURA_TEXTO) / 2}px 0`,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        fontSize: "12px",
        fontWeight: 700,
        color: "var(--t-deep)",
        background: "none",
        border: 0,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}
