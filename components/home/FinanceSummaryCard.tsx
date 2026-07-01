"use client";

import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { AreaSparkline } from "@/components/charts/AreaSparkline";
import { ProgressRing } from "@/components/charts/ProgressRing";
import type { Job, Meta, CardStyle } from "@/lib/types";

interface Props {
  jobs: Job[];
  metas: Meta[];
  style?: CardStyle;
  onGoToFinanceiro: () => void;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

function monthEarnings(jobs: Job[]): number {
  const now = new Date();
  return jobs
    .filter((j) => {
      if (j.status !== "concluído") return false;
      const d = new Date(j.data + "T00:00:00");
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    })
    .reduce((s, j) => s + j.valor, 0);
}

function prevMonthEarnings(jobs: Job[]): number {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return jobs
    .filter((j) => {
      if (j.status !== "concluído") return false;
      const d = new Date(j.data + "T00:00:00");
      return (
        d.getMonth() === prev.getMonth() &&
        d.getFullYear() === prev.getFullYear()
      );
    })
    .reduce((s, j) => s + j.valor, 0);
}

function last7DaysSparkline(jobs: Job[]): number[] {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  return days.map((day) => {
    const ds = day.toISOString().slice(0, 10);
    return jobs
      .filter((j) => j.status === "concluído" && j.data === ds)
      .reduce((s, j) => s + j.valor, 0);
  });
}

export function FinanceSummaryCard({
  jobs,
  metas,
  style = "standard",
  onGoToFinanceiro,
}: Props) {
  const current = monthEarnings(jobs);
  const prev = prevMonthEarnings(jobs);
  const spark = last7DaysSparkline(jobs);
  const monthMeta = metas.find((m) => m.periodo === "mes");
  const pct = monthMeta
    ? Math.min(100, (current / monthMeta.valorAlvo) * 100)
    : null;
  const diff = prev > 0 ? ((current - prev) / prev) * 100 : null;
  const up = diff !== null && diff >= 0;

  const month = new Date().toLocaleDateString("pt-BR", { month: "long" });

  if (style === "compact") {
    return (
      <button
        className="glass-card w-full rounded-[22px] p-4 text-left transition-all active:opacity-70 active:scale-[0.99]"
        onClick={onGoToFinanceiro}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="section-label mb-1">Este mês</p>
            <p
              className="font-extrabold text-[22px] tabular-nums"
              style={{
                color: "var(--accent)",
                letterSpacing: "-0.03em",
                textShadow: "0 0 20px rgb(var(--accent-rgb) / 0.5)",
              }}
            >
              {formatBRL(current)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pct !== null && (
              <ProgressRing
                progress={pct}
                size={52}
                strokeWidth={5}
                valueLabel={`${Math.round(pct)}%`}
              />
            )}
            <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      className="glass-card w-full rounded-[22px] p-5 text-left transition-all active:opacity-70 active:scale-[0.99]"
      onClick={onGoToFinanceiro}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="section-label capitalize">{month}</p>
        <div className="flex items-center gap-1.5">
          {diff !== null && (
            <span
              className="flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: up
                  ? "rgba(80,220,120,0.12)"
                  : "rgba(255,80,80,0.12)",
                color: up ? "#50dc78" : "#ff5050",
                border: `1px solid ${up ? "rgba(80,220,120,0.25)" : "rgba(255,80,80,0.22)"}`,
              }}
            >
              {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(diff).toFixed(0)}%
            </span>
          )}
          <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      {/* Main value + ring */}
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <p
            className="font-extrabold tabular-nums leading-none"
            style={{
              fontSize: "28px",
              letterSpacing: "-0.035em",
              color: "var(--accent)",
              textShadow: "0 0 24px rgb(var(--accent-rgb) / 0.5)",
            }}
          >
            {formatBRL(current)}
          </p>
          {monthMeta && (
            <p
              className="text-xs mt-1 tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              meta: {formatBRL(monthMeta.valorAlvo)}
            </p>
          )}
        </div>

        {pct !== null && (
          <ProgressRing
            progress={pct}
            size={64}
            strokeWidth={6}
            valueLabel={`${Math.round(pct)}%`}
            label="da meta"
          />
        )}
      </div>

      {/* Sparkline */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgb(var(--accent-rgb) / 0.04)",
          border: "1px solid rgb(var(--accent-rgb) / 0.08)",
        }}
      >
        <AreaSparkline data={spark} height={52} id="home-spark" />
      </div>
      <p
        className="text-[10px] mt-1.5 text-right"
        style={{ color: "var(--text-muted)" }}
      >
        últimos 7 dias
      </p>
    </button>
  );
}
