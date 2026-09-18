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
        // `width`/`textAlign` normalizam o <button> nativo (senão fica
        // inline-block/centralizado) — mas `display` NÃO entra aqui: um
        // valor fixo (ex. "block") num `style` inline sempre vence a
        // classe `flex`/`grid` que a chamadora passar em `className`
        // (inline sempre bate classe, mesma propriedade), quebrando
        // qualquer GlassCard-botão que dependa de layout flex/grid no
        // próprio elemento — achado real em produção (T20/#127:
        // ContextualBlock, MeuEspacoScreen "Clientes", composer do Feed,
        // 3 linhas de Ajustes), não hipotético. `width:100%` já garante
        // o botão ocupar a linha toda mesmo com o inline-block nativo do
        // <button> (que aceita width explícita); sem `display` fixo aqui,
        // a classe da chamadora decide o `display` livremente.
        ...(Tag === "button" ? { width: "100%", textAlign: "left" } : {}),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
