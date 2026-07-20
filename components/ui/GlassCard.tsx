"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

/**
 * A primitiva de vidro única do app. Envelopa a classe `.glass-card`
 * (blur + borda accent + shine) e aplica a escala de raio semântica.
 * Substitui os cards de vidro reinventados inline (Independência, Receita/
 * Despesa, sheets…). Renderiza <div> por padrão; vira <button> quando é
 * tocável (onClick) para manter acessibilidade.
 */

type Radius = "sm" | "md" | "lg" | "xl";

const RADIUS: Record<Radius, string> = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
};

interface Props {
  children: ReactNode;
  /** Escala de raio (padrão lg = 20px). */
  radius?: Radius;
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLElement>;
  /** Força a tag; por padrão é <button> se houver onClick, senão <div>. */
  as?: "div" | "button";
  ariaLabel?: string;
}

export function GlassCard({
  children,
  radius = "lg",
  className = "",
  style,
  onClick,
  as,
  ariaLabel,
}: Props) {
  const Tag = as ?? (onClick ? "button" : "div");
  const interactive = Tag === "button" || Boolean(onClick);

  return (
    <Tag
      onClick={onClick}
      aria-label={ariaLabel}
      className={`glass-card ${
        interactive
          ? "transition-all active:scale-[0.99] active:opacity-90"
          : ""
      } ${className}`}
      style={{
        borderRadius: RADIUS[radius],
        ...(Tag === "button"
          ? { width: "100%", textAlign: "left", display: "block" }
          : {}),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
