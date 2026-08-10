"use client";

import { Plus, TrendingDown, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatBRL, formatShortDate } from "@/lib/finance";
import { CAT_LABELS, CAT_EMOJIS } from "./constants";
import type { Despesa } from "@/lib/types";

/**
 * Superfície sólida — mesmo padrão de VisaoTab.tsx/EntradasTab.tsx (T4),
 * Início (T2) e Agenda (T3).
 */
const SOLID_SURFACE_STYLE = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
  border: "1px solid var(--border-color)",
} as const;

interface Props {
  despesas: Despesa[];
  despMes: Despesa[];
  totalDespMes: number;
  onAddDespesa?: () => void;
  onDeleteDespesa: (id: string) => void;
}

export function SaidasTab({
  despesas,
  despMes,
  totalDespMes,
  onAddDespesa,
  onDeleteDespesa,
}: Props) {
  const catTotals = despMes.reduce(
    (acc, d) => {
      acc[d.categoria] = (acc[d.categoria] || 0) + d.valor;
      return acc;
    },
    {} as Record<string, number>
  );
  const catEntries = Object.entries(catTotals).sort(([, a], [, b]) => b - a);
  const maxVal = Math.max(...Object.values(catTotals), 1);

  return (
    <div>
      {/* Header total */}
      <GlassCard
        radius="md"
        className="p-4 mb-4 flex items-center justify-between"
        style={SOLID_SURFACE_STYLE}
      >
        <div>
          {/* Legenda sentence-case — não `.section-label`, mesma
              causa-raiz já corrigida em T2/T4. */}
          <p
            className="mb-0.5"
            style={{ fontSize: "11px", color: "var(--text-muted)" }}
          >
            Total este mês
          </p>
          <p
            className="font-extrabold text-[22px] tabular-nums"
            style={{ color: "var(--danger)" }}
          >
            {formatBRL(totalDespMes, 2)}
          </p>
        </div>
        <TrendingDown
          size={24}
          color="var(--danger)"
          style={{ opacity: 0.5 }}
        />
      </GlassCard>

      <button
        onClick={() => onAddDespesa?.()}
        className="flex items-center gap-2 w-full py-3 rounded-2xl mb-4 font-bold text-sm transition-all active:scale-[0.98]"
        style={{
          background: "rgb(var(--danger-rgb) / 0.1)",
          color: "var(--danger)",
          border: "1px dashed rgb(var(--danger-rgb) / 0.35)",
        }}
      >
        <Plus size={16} style={{ marginLeft: "auto", marginRight: 4 }} />
        <span style={{ marginRight: "auto" }}>Nova Saída</span>
      </button>

      {/* Breakdown por categoria */}
      {catEntries.length > 0 && (
        <GlassCard radius="md" className="p-4 mb-4" style={SOLID_SURFACE_STYLE}>
          <p
            className="mb-3"
            style={{ fontSize: "11px", color: "var(--text-muted)" }}
          >
            Por categoria
          </p>
          {catEntries.map(([cat, val]) => (
            <div key={cat} className="flex items-center gap-3 mb-2.5">
              <span style={{ fontSize: 16 }}>{CAT_EMOJIS[cat] ?? "📦"}</span>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {CAT_LABELS[cat] ?? cat}
                  </span>
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: "var(--danger)" }}
                  >
                    {formatBRL(val)}
                  </span>
                </div>
                <div className="progress-track" style={{ height: 3 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(val / maxVal) * 100}%`,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      {despesas.length === 0 ? (
        <p
          className="text-sm text-center pt-8"
          style={{ color: "var(--text-muted)" }}
        >
          Nenhuma despesa registrada ainda. Toque em Nova Saída para começar.
        </p>
      ) : (
        <div className="space-y-2">
          {despesas.map((d) => (
            <GlassCard
              key={d.id}
              radius="md"
              className="flex items-center gap-3 px-4 py-3"
              style={SOLID_SURFACE_STYLE}
            >
              <span style={{ fontSize: 20 }}>
                {CAT_EMOJIS[d.categoria] ?? "📦"}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-sm truncate"
                  style={{ color: "var(--text)" }}
                >
                  {d.descricao}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-2)" }}
                >
                  {CAT_LABELS[d.categoria] ?? d.categoria} ·{" "}
                  {formatShortDate(d.data)}
                </p>
              </div>
              <span
                className="font-bold text-sm tabular-nums shrink-0"
                style={{ color: "var(--danger)" }}
              >
                -{formatBRL(d.valor)}
              </span>
              {/* 44×44px — alvo de toque mínimo (spec); era 28×28px
                  (achado P1-6 do relatório de paridade). */}
              <button
                onClick={() => onDeleteDespesa(d.id)}
                aria-label="Excluir despesa"
                className="shrink-0 flex items-center justify-center rounded-lg transition-opacity active:opacity-50"
                style={{
                  width: 44,
                  height: 44,
                  background: "rgb(var(--danger-rgb) / 0.1)",
                }}
              >
                <Trash2 size={13} color="var(--danger)" />
              </button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
