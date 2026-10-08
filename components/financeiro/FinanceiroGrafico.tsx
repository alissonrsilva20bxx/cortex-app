"use client";

import { useState } from "react";
import { MiniBarChart } from "@/components/charts/MiniBarChart";
import { AreaSparkline } from "@/components/charts/AreaSparkline";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  buildChartData,
  last30DaysSpark,
  type ChartPeriod,
} from "@/lib/finance";
import type { Job, ReceitaAvulsa } from "@/lib/types";
import { FinCard } from "./FinCard";

const PERIOD_OPTS: { id: ChartPeriod; label: string }[] = [
  { id: "sem", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
];

interface Props {
  jobs: Job[];
  receitas: ReceitaAvulsa[];
  chartType?: "bar" | "area";
}

/**
 * Gráfico de palitos do Financeiro (preferência real de Ajustes: barras ou
 * área), no topo, logo abaixo dos 4 cards -- decisão do operador: é o
 * lugar e o desenho de antes da PR de pixel (4451e1b^), restaurados bloco
 * a bloco (MiniBarChart/AreaSparkline com altura 100, FinCard padding 16,
 * "Resumo financeiro" 11px/600). O mockup normativo do Financeiro A não tem
 * gráfico; a referência do Financeiro com o gráfico fica em
 * docs/jornada/prints/pixel/financeiro/referencia-com-grafico-*.png.
 *
 * O seletor Semana/Mês/Ano só existe no modo barras: no modo área o
 * gráfico é sempre os últimos 30 dias (last30DaysSpark) -- comportamento
 * de antes, preservado. Mesmos dados de antes (`buildChartData`).
 */
export function FinanceiroGrafico({
  jobs,
  receitas,
  chartType = "bar",
}: Props) {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("sem");
  const chartData = buildChartData(jobs, receitas, chartPeriod);
  const sparkData = last30DaysSpark(jobs, receitas);

  return (
    <FinCard style={{ padding: "16px" }}>
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-semibold"
          style={{ fontSize: "11px", color: "var(--text-muted)" }}
        >
          Resumo financeiro
        </span>
        {chartType !== "area" && (
          <SegmentedControl
            size="sm"
            // #174: Semana/Mês/Ano com alvo de toque de 44px.
            minTouchTarget
            options={PERIOD_OPTS}
            value={chartPeriod}
            onChange={setChartPeriod}
          />
        )}
      </div>
      {chartType === "area" ? (
        <AreaSparkline data={sparkData} height={100} id="fin-hero-area" />
      ) : (
        <MiniBarChart data={chartData} height={100} id="fin-hero-bar" />
      )}
    </FinCard>
  );
}
