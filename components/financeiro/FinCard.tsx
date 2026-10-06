"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * O card do Financeiro no visual novo (Jornada J04): superfície opaca
 * `--card-solid` (token da J01, extraído do mockup), raio `--radius-lg`.
 * Um lugar só pra essa superfície -- nenhum card do Financeiro repete o
 * próprio fundo. Mesma receita do card da Início (J02), mantida aqui pra
 * cada aba ter os próprios arquivos.
 */
interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function FinCard({ children, className = "", style }: Props) {
  return (
    <div
      className={className}
      style={{
        borderRadius: "var(--radius-lg)",
        background: "var(--card-solid)",
        color: "var(--text)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
