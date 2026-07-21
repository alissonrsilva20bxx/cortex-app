"use client";

import type { ReactNode } from "react";

/**
 * Fileira de chips de filtro com rolagem horizontal. Unifica as cópias
 * idênticas de Jobs e Cofre (o inventário apontou copy-paste literal).
 * Uma implementação, consumida por quem filtra listas.
 */

interface Chip<T extends string> {
  id: T;
  label: ReactNode;
}

interface Props<T extends string> {
  options: Chip<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: Props<T>) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar ${className}`}
    >
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
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
