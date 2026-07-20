"use client";

import type { ReactNode } from "react";

/**
 * Controle segmentado único (pílula ativa deslizante em espírito).
 * Substitui as 5+ cópias inline (abas do Financeiro, seletor de período,
 * período do Jobs, gráficos do Ajustes…), cada uma com trilho e cor de
 * texto ativo divergentes. Uma implementação, dois tamanhos.
 */

interface Option<T extends string> {
  id: T;
  label: ReactNode;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (id: T) => void;
  /** md = abas de tela (largura cheia); sm = seletor compacto. */
  size?: "sm" | "md";
  /** Distribui os itens em largura igual (padrão true no md). */
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth,
  className = "",
}: Props<T>) {
  const isMd = size === "md";
  const stretch = fullWidth ?? isMd;

  return (
    <div
      className={`flex ${isMd ? "gap-1 p-1 rounded-2xl" : "gap-1 p-0.5 rounded-xl"} ${className}`}
      style={{ background: isMd ? "var(--surface)" : "var(--surface-2)" }}
    >
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`${stretch ? "flex-1" : ""} font-bold transition-all ${
              isMd
                ? "py-2 rounded-xl text-xs"
                : "px-2.5 py-1 rounded-lg text-[11px]"
            }`}
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#fff" : "var(--text-muted)",
              boxShadow: active && isMd ? "var(--glow-sm)" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
