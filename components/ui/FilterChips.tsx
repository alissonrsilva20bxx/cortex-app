"use client";

import type { ReactNode } from "react";

/**
 * Fileira de chips de filtro (mesma pílula ativa/inativa em dois layouts:
 * rolagem horizontal — padrão — ou grade fixa via `columns`). Unifica as
 * cópias idênticas de Jobs e Cofre, e o seletor de categoria do Cofre
 * (upload), que reinventava a mesma lógica de estado numa grade 2×2.
 * Uma implementação, consumida por quem escolhe entre opções exclusivas.
 */

interface Chip<T extends string> {
  id: T;
  label: ReactNode;
}

interface Props<T extends string> {
  options: Chip<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Número de colunas para layout em grade; omitido = rolagem horizontal. */
  columns?: number;
  className?: string;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  columns,
  className = "",
}: Props<T>) {
  return (
    <div
      className={
        columns
          ? `grid gap-2 ${className}`
          : `flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar ${className}`
      }
      style={
        columns
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`${columns ? "" : "shrink-0"} px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all`}
            style={{
              background: active
                ? "rgb(var(--accent-rgb) / 0.18)"
                : "var(--surface)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "var(--glow-sm)" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
