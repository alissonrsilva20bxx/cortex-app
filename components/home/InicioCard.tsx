"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * O card da Início no visual novo (Jornada J02): superfície opaca
 * `--card-solid` (token da J01, extraído do mockup), raio `--radius-lg`.
 * Um lugar só pra essa superfície -- nenhum card da Início repete o
 * próprio fundo. `tom="cofre"` é o card escuro do mockup (`--hero-bg`).
 * Vira <button> quando é tocável, pra teclado e leitor de tela.
 */
interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
  tom?: "padrao" | "cofre";
}

export function InicioCard({
  children,
  className = "",
  style,
  onClick,
  ariaLabel,
  tom = "padrao",
}: Props) {
  const base: CSSProperties = {
    borderRadius: "var(--radius-lg)",
    background: tom === "cofre" ? "var(--hero-bg)" : "var(--card-solid)",
    color: tom === "cofre" ? "#fff" : "var(--text)",
    ...style,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        // #131: o FAB recua se colidir com uma ação real (ver FAB.tsx).
        data-fab-avoid
        className={`text-left w-full transition-transform active:scale-[0.99] ${className}`}
        style={base}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={className} style={base}>
      {children}
    </div>
  );
}
