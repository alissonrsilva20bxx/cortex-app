"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Peças dos cards pequenos da Início, com os valores literais do mockup
 * normativo (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html,
 * tela Início): ícone 20×20 traço 2 em `--t-deep`, rótulo 11px/600 em
 * `--t-mut`, valor 20px/800.
 */
export function IconeCard({
  cor = "var(--t-deep)",
  children,
}: {
  cor?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export const ROTULO_CARD: CSSProperties = {
  fontSize: "11px",
  color: "var(--t-mut)",
  fontWeight: 600,
};

export const VALOR_CARD: CSSProperties = { fontSize: "20px", fontWeight: 800 };

/** `padding:16px; display:flex; flex-direction:column; gap:8px` */
export const CARD_PEQUENO: CSSProperties = {
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
