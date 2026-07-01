"use client";

import { TrendingUp, TrendingDown, Crown, Lock } from "lucide-react";
import { AreaSparkline } from "@/components/charts/AreaSparkline";
import type { Job, Meta } from "@/lib/types";

interface Props {
  jobs: Job[];
  metas: Meta[];
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

export function IndependenciaCard({ jobs, metas, onGoToFinanceiro }: Props) {
  const current = monthEarnings(jobs);
  const prev = prevMonthEarnings(jobs);
  const spark = last7DaysSparkline(jobs);
  const monthMeta = metas.find((m) => m.periodo === "mes");
  const pct = monthMeta
    ? Math.min(100, (current / monthMeta.valorAlvo) * 100)
    : null;
  const diff = prev > 0 ? ((current - prev) / prev) * 100 : null;
  const up = diff !== null && diff >= 0;

  return (
    <button
      onClick={onGoToFinanceiro}
      className="group w-full rounded-[24px] p-6 text-left transition-all active:scale-[0.98] overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgb(var(--accent-rgb) / 0.15) 0%, rgb(var(--accent-rgb) / 0.05) 100%)",
        border: "1.5px solid rgb(var(--accent-rgb) / 0.25)",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Background decorative elements */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            "radial-gradient(circle at 20% 50%, rgb(var(--accent-rgb) / 0.1) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      <div className="relative z-10">
        {/* Header com ícone de coroa */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown
              size={18}
              style={{ color: "var(--accent)" }}
              className="opacity-80"
            />
            <p
              className="font-bold text-sm uppercase tracking-wide"
              style={{ color: "var(--accent)", letterSpacing: "0.05em" }}
            >
              Sua Independência
            </p>
          </div>
          <Lock
            size={14}
            style={{ color: "var(--text-muted)" }}
            className="opacity-60"
          />
        </div>

        {/* Main value */}
        <div className="mb-5">
          <p
            className="font-black tabular-nums leading-none mb-1"
            style={{
              fontSize: "36px",
              letterSpacing: "-0.04em",
              color: "var(--accent)",
              textShadow: "0 0 30px rgb(var(--accent-rgb) / 0.6)",
            }}
          >
            {formatBRL(current)}
          </p>
          {monthMeta && (
            <p
              className="text-xs font-medium tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              Meta: {formatBRL(monthMeta.valorAlvo)} •{" "}
              {pct !== null && `${Math.round(pct)}% alcançado`}
            </p>
          )}
        </div>

        {/* Comparison with previous month */}
        {diff !== null && (
          <div className="flex items-center gap-2 mb-4">
            <div
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full"
              style={{
                background: up
                  ? "rgba(80,220,120,0.15)"
                  : "rgba(255,100,80,0.15)",
                color: up ? "#50dc78" : "#ff6450",
                border: `1px solid ${
                  up ? "rgba(80,220,120,0.3)" : "rgba(255,100,80,0.3)"
                }`,
              }}
            >
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(diff).toFixed(0)}% vs mês anterior</span>
            </div>
          </div>
        )}

        {/* Sparkline */}
        <div
          className="rounded-[14px] overflow-hidden"
          style={{
            background: "rgb(var(--accent-rgb) / 0.06)",
            border: "1px solid rgb(var(--accent-rgb) / 0.1)",
          }}
        >
          <AreaSparkline data={spark} height={48} id="independencia-spark" />
        </div>

        <p
          className="text-[11px] font-medium mt-2 text-right"
          style={{ color: "var(--text-muted)" }}
        >
          Últimos 7 dias
        </p>
      </div>
    </button>
  );
}
