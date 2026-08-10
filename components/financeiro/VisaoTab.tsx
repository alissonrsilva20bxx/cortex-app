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

/**
 * Superfície sólida (sem blur), como no laboratório visual — mesmo
 * padrão já estabelecido em Início (T2) e Agenda (T3): "conteúdo
 * sólido, vidro só pra navegação/sheets". Repetido aqui (não extraído
 * pra `components/ui/`) porque o escopo deste ticket é só os arquivos
 * de `components/financeiro/`.
 */
const SOLID_SURFACE_STYLE = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
  border: "1px solid var(--border-color)",
  boxShadow:
    "inset 0 1px 0 rgb(255 255 255 / 0.035), 0 10px 30px rgb(0 0 0 / 0.18)",
} as const;

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
      {/* Entradas / Saídas — composição "Metric" do laboratório (legenda
          simples, valor, nota, selo circular com seta ao final), como
          FinanceScreen (LaunchScreens.tsx:734-761). Sem borda lateral
          colorida: o laboratório não usa (o sinal de cor vem só do selo
          e do valor). Dado 100% real — nada copiado do mock. */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard radius="md" className="p-4" style={SOLID_SURFACE_STYLE}>
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Entradas
          </p>
          <p
            className="font-medium mt-1"
            style={{ fontSize: "16px", color: "var(--success)" }}
          >
            {formatBRL(totalEntradaMes)}
          </p>
          <p
            className="mt-1"
            style={{ fontSize: "9px", color: "var(--text-muted)" }}
          >
            este mês
          </p>
          <div
            className="mt-3 grid place-items-center rounded-full"
            style={{
              width: "32px",
              height: "32px",
              background: "rgb(var(--success-rgb) / 0.12)",
            }}
          >
            <TrendingUp size={14} style={{ color: "var(--success)" }} />
          </div>
        </GlassCard>
        <GlassCard radius="md" className="p-4" style={SOLID_SURFACE_STYLE}>
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Saídas
          </p>
          <p
            className="font-medium mt-1"
            style={{ fontSize: "16px", color: "var(--danger)" }}
          >
            {formatBRL(totalDespMes)}
          </p>
          <p
            className="mt-1"
            style={{ fontSize: "9px", color: "var(--text-muted)" }}
          >
            este mês
          </p>
          <div
            className="mt-3 grid place-items-center rounded-full"
            style={{
              width: "32px",
              height: "32px",
              background: "rgb(var(--danger-rgb) / 0.12)",
            }}
          >
            <TrendingDown size={14} style={{ color: "var(--danger)" }} />
          </div>
        </GlassCard>
      </div>

      {/* Saldo do mês — legenda sentence-case (11px/medium/muted), como o
          laboratório (page.tsx "Saldo do mês", text-[10px] text-white/55
          — 12px renderizado dentro de .launch-preview; aqui usamos o
          valor real renderizado, não o literal Tailwind, mesma lição já
          registrada em T2/T3). Valor 28px/medium/-0.055em, literal do
          laboratório. NÃO portamos a linha "Meta: X / Y% da meta" do
          laboratório sob o saldo: o dado real de meta já tem sua própria
          superfície dedicada (aba Metas, com contexto — meta diária,
          mensal e anual — que o card de saldo não tem espaço pra
          mostrar sem ambiguidade sobre qual meta se aplica). Duplicar
          aqui exigiria decidir arbitrariamente qual meta comparar contra
          o saldo; preferimos não inventar essa relação. */}
      <GlassCard radius="md" className="p-4" style={SOLID_SURFACE_STYLE}>
        <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Saldo do mês
        </p>
        <p
          className="font-medium mt-1 tabular-nums"
          style={{
            fontSize: "28px",
            letterSpacing: "-0.055em",
            color: saldo >= 0 ? "var(--accent)" : "var(--danger)",
            textShadow:
              saldo >= 0
                ? "0 0 18px rgb(var(--accent-rgb) / 0.4)"
                : "0 0 18px rgb(var(--danger-rgb) / 0.4)",
          }}
        >
          {formatBRL(saldo, 2)}
        </p>
      </GlassCard>

      {/* Gráfico — superfície e legenda adaptadas ao laboratório; o
          gráfico em si (MiniBarChart/AreaSparkline) fica fora do escopo
          de arquivos deste ticket (components/charts/**), então mantém
          sua própria renderização interna, só o card ao redor mudou.
          Rótulo "Receitas" preservado (não renomeado para "Evolução do
          saldo" como o laboratório): o dado real por trás
          (buildChartData) soma entradas (jobs concluídos + receitas
          avulsas), não desconta despesas — chamá-lo de "saldo" seria
          rotular errado um dado real que já existe e funciona. */}
      <GlassCard radius="md" className="p-4" style={SOLID_SURFACE_STYLE}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Receitas
          </p>
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
