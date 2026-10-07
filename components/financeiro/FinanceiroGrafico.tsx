"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  buildChartData,
  last30DaysSpark,
  type ChartPeriod,
} from "@/lib/finance";
import type { Job, ReceitaAvulsa } from "@/lib/types";

const PERIOD_OPTS: { id: ChartPeriod; label: string }[] = [
  { id: "sem", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
];

/** Altura da área das barras/linha, em px (o gráfico inteiro tem 100). */
const ALTURA_GRAFICO = 82;

interface Props {
  jobs: Job[];
  receitas: ReceitaAvulsa[];
  chartType?: "bar" | "area";
}

/**
 * Barras na linguagem do mockup normativo: trilho `--t-soft`, barra
 * `--t-acc` lisa (sem degradê nem brilho), raio 6, rótulo 10px `--t-mut`
 * em texto de verdade. HTML em vez de SVG esticado: o SVG antigo usava
 * `preserveAspectRatio="none"` e achatava rótulos e cantos.
 */
function Barras({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 0.01);
  return (
    <div
      style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}
      aria-hidden
    >
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${ALTURA_GRAFICO}px`,
              borderRadius: "6px",
              background: "var(--t-soft)",
              display: "flex",
              alignItems: "flex-end",
              overflow: "hidden",
            }}
          >
            {d.value > 0 && (
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(4, (d.value / max) * ALTURA_GRAFICO)}px`,
                  borderRadius: "6px",
                  background: "var(--t-acc)",
                }}
              />
            )}
          </div>
          <span
            style={{
              fontSize: "10px",
              color: "var(--t-mut)",
              whiteSpace: "nowrap",
            }}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Área (últimos 30 dias) na mesma linguagem: preenchimento `--t-soft`,
 * linha `--t-acc` de 2px que não deforma ao esticar
 * (`vector-effect: non-scaling-stroke`), ponto final redondo em HTML.
 */
function Area({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.01);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - (v / max) * 92,
  }));
  const linha = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const ultimo = pts[pts.length - 1];
  return (
    <div
      style={{ position: "relative", height: `${ALTURA_GRAFICO + 18}px` }}
      aria-hidden
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <path d={`${linha} L100,100 L0,100 Z`} fill="var(--t-soft)" />
        <path
          d={linha}
          fill="none"
          stroke="var(--t-acc)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          left: `calc(${ultimo.x}% - 4px)`,
          top: `calc(${ultimo.y}% - 4px)`,
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "var(--t-acc)",
        }}
      />
    </div>
  );
}

/**
 * Gráfico "Resumo financeiro" (preferência real de Ajustes: barras ou
 * área). O mockup normativo do Financeiro A não tem gráfico; ele saiu do
 * topo e mora abaixo dos lançamentos, no card do mockup (`--t-card`, raio
 * 20, padding 16, rótulo 11px/600 `--t-mut`), pra que a primeira tela seja
 * igual ao mockup sem perder a preferência. O seletor Semana/Mês/Ano só
 * existe no modo barras; no modo área o gráfico é sempre os últimos 30
 * dias (comportamento de antes, preservado). Mesmos dados de antes
 * (`buildChartData`, `last30DaysSpark`).
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
    <section
      style={{
        background: "var(--t-card)",
        color: "var(--t-ink)",
        borderRadius: "20px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{ fontSize: "11px", fontWeight: 600, color: "var(--t-mut)" }}
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
        <Area data={sparkData} />
      ) : chartData.length > 0 ? (
        <Barras data={chartData} />
      ) : null}
    </section>
  );
}
