"use client";

import { Plus, TrendingUp, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatBRL, formatShortDate } from "@/lib/finance";
import { REC_CAT_EMOJIS, REC_CAT_LABELS } from "./constants";
import type { Job, ReceitaAvulsa } from "@/lib/types";

interface Props {
  jobs: Job[];
  receitas: ReceitaAvulsa[];
  totalEntradaMes: number;
  onAddReceita?: () => void;
  onDeleteReceita: (id: string) => void;
}

export function EntradasTab({
  jobs,
  receitas,
  totalEntradaMes,
  onAddReceita,
  onDeleteReceita,
}: Props) {
  const jobEntradas = jobs
    .filter((j) => j.status === "concluído")
    .map((j) => ({
      id: j.id,
      desc: j.clienteNome,
      valor: j.valor,
      data: j.data,
      tipo: "job" as const,
      cat: "job",
    }));
  const recEntradas = receitas.map((r) => ({
    id: r.id,
    desc: r.descricao,
    valor: r.valor,
    data: r.data,
    tipo: "receita" as const,
    cat: r.categoria,
  }));
  const all = [...jobEntradas, ...recEntradas].sort((a, b) =>
    b.data.localeCompare(a.data)
  );

  return (
    <div>
      {/* Header total */}
      <GlassCard
        radius="md"
        className="p-4 mb-4 flex items-center justify-between"
      >
        <div>
          <p className="section-label mb-0.5">Total este mês</p>
          <p
            className="font-extrabold text-[22px] tabular-nums"
            style={{ color: "var(--success)" }}
          >
            {formatBRL(totalEntradaMes, 2)}
          </p>
        </div>
        <TrendingUp size={24} color="var(--success)" style={{ opacity: 0.5 }} />
      </GlassCard>

      <button
        onClick={() => onAddReceita?.()}
        className="flex items-center gap-2 w-full py-3 rounded-2xl mb-4 font-bold text-sm transition-all active:scale-[0.98]"
        style={{
          background: "rgb(var(--success-rgb) / 0.1)",
          color: "var(--success)",
          border: "1px dashed rgb(var(--success-rgb) / 0.35)",
        }}
      >
        <Plus size={16} style={{ marginLeft: "auto", marginRight: 4 }} />
        <span style={{ marginRight: "auto" }}>Nova Entrada</span>
      </button>

      {all.length === 0 ? (
        <p
          className="text-sm text-center pt-12"
          style={{ color: "var(--text-muted)" }}
        >
          Nenhuma entrada ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {all.map((item) => (
            <GlassCard
              key={item.tipo + item.id}
              radius="md"
              className="flex items-center gap-3 px-4 py-3"
            >
              <span style={{ fontSize: 20 }}>
                {item.tipo === "job"
                  ? "💼"
                  : (REC_CAT_EMOJIS[item.cat] ?? "💰")}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-sm truncate"
                  style={{ color: "var(--text)" }}
                >
                  {item.desc}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-2)" }}
                >
                  {item.tipo === "job"
                    ? "Atendimento"
                    : (REC_CAT_LABELS[item.cat] ?? item.cat)}{" "}
                  · {formatShortDate(item.data)}
                </p>
              </div>
              <span
                className="font-bold text-sm tabular-nums shrink-0"
                style={{ color: "var(--success)" }}
              >
                +{formatBRL(item.valor)}
              </span>
              {item.tipo === "receita" && (
                <button
                  onClick={() => onDeleteReceita(item.id)}
                  className="shrink-0 flex items-center justify-center rounded-lg transition-opacity active:opacity-50"
                  style={{
                    width: 28,
                    height: 28,
                    background: "rgb(var(--danger-rgb) / 0.08)",
                  }}
                >
                  <Trash2 size={13} color="var(--danger)" />
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
