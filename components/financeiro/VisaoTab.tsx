"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MiniBarChart } from "@/components/charts/MiniBarChart";
import { AreaSparkline } from "@/components/charts/AreaSparkline";
import {
  formatBRL,
  buildChartData,
  last30DaysSpark,
  type ChartPeriod,
} from "@/lib/finance";
import type { Job, ReceitaAvulsa } from "@/lib/types";

interface Props {
  jobs: Job[];
  receitas: ReceitaAvulsa[];
  totalEntradaMes: number;
  totalDespMes: number;
  saldo: number;
  chartType?: "bar" | "area";
}

const PERIOD_OPTS: { id: ChartPeriod; label: string }[] = [
  { id: "sem", label: "S" },
  { id: "mes", label: "M" },
  { id: "ano", label: "A" },
];

export function VisaoTab({
  jobs,
  receitas,
  totalEntradaMes,
  totalDespMes,
  saldo,
  chartType = "bar",
}: Props) {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("sem");
  const chartData = buildChartData(jobs, receitas, chartPeriod);
  const sparkData = last30DaysSpark(jobs, receitas);

  return (
    <div className="space-y-4">
      {/* Entradas / Saídas cards */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard
          radius="md"
          className="p-4 flex flex-col gap-1"
          style={{ borderLeft: "3px solid var(--success)" }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} color="var(--success)" />
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--success)" }}
            >
              Entradas
            </p>
          </div>
          <p
            className="font-extrabold text-[17px] tabular-nums leading-none"
            style={{ color: "var(--text)" }}
          >
            {formatBRL(totalEntradaMes)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            este mês
          </p>
        </GlassCard>
        <GlassCard
          radius="md"
          className="p-4 flex flex-col gap-1"
          style={{ borderLeft: "3px solid var(--danger)" }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={13} color="var(--danger)" />
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--danger)" }}
            >
              Saídas
            </p>
          </div>
          <p
            className="font-extrabold text-[17px] tabular-nums leading-none"
            style={{ color: "var(--text)" }}
          >
            {formatBRL(totalDespMes)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            este mês
          </p>
        </GlassCard>
      </div>

      {/* Saldo */}
      <GlassCard radius="md" className="p-4">
        <p className="section-label mb-1">Saldo do mês</p>
        <p
          className="font-extrabold text-[26px] tabular-nums"
          style={{
            color: saldo >= 0 ? "var(--accent)" : "var(--danger)",
            letterSpacing: "-0.03em",
            textShadow:
              saldo >= 0
                ? "0 0 18px rgb(var(--accent-rgb) / 0.4)"
                : "0 0 18px rgb(var(--danger-rgb) / 0.4)",
          }}
        >
          {formatBRL(saldo, 2)}
        </p>
      </GlassCard>

      {/* Chart com seletor de período */}
      <GlassCard radius="md" className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Receitas</p>
          {chartType !== "area" && (
            <SegmentedControl
              size="sm"
              options={PERIOD_OPTS}
              value={chartPeriod}
              onChange={setChartPeriod}
            />
          )}
        </div>
        {chartType === "area" ? (
          <AreaSparkline data={sparkData} height={90} id="fin-area" />
        ) : (
          <MiniBarChart data={chartData} height={110} id="fin-bar" />
        )}
      </GlassCard>
    </div>
  );
}
