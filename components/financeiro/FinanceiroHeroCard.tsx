"use client";

import { useState } from "react";
import { Target, TrendingDown, TrendingUp } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MiniBarChart } from "@/components/charts/MiniBarChart";
import { AreaSparkline } from "@/components/charts/AreaSparkline";
import {
  formatBRL,
  calcEarnings,
  monthExpenses,
  monthMeta,
  buildChartData,
  last30DaysSpark,
  type ChartPeriod,
} from "@/lib/finance";
import type { Job, Despesa, Meta, ReceitaAvulsa } from "@/lib/types";
import { FinCard } from "./FinCard";
import { progressoMeta } from "./progressoMeta";

const PERIOD_OPTS: { id: ChartPeriod; label: string }[] = [
  { id: "sem", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
];

interface Props {
  jobs: Job[];
  receitas: ReceitaAvulsa[];
  despesas: Despesa[];
  totalEntradaMes: number;
  totalDespMes: number;
  saldo: number;
  metas: Meta[];
  chartType?: "bar" | "area";
}

/**
 * Topo do Financeiro no visual novo (Jornada J04, mockup
 * `5-telas-8-temas-claro-escuro.html`, tela Financeiro): o card "Saldo do
 * mês" com a pílula de comparação, o saldo, a barra entrou/saiu, e a grade
 * de cards pequenos (Entradas, Saídas, Meta). Fica acima das sub-abas,
 * sempre visível (#136). Nenhuma conta nova: saldo e totais chegam
 * prontos do FinanceiroTab, a variação é a mesma de antes (#136) e o
 * percentual da meta é o mesmo do MetasTab (`progressoMeta`).
 *
 * O gráfico (preferência barras/área de Ajustes) não está no mockup, mas
 * é a única tela que obedece essa preferência -- continua, num card
 * próprio, abaixo da grade.
 */
export function FinanceiroHeroCard({
  jobs,
  receitas,
  despesas,
  totalEntradaMes,
  totalDespMes,
  saldo,
  metas,
  chartType = "bar",
}: Props) {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("sem");
  const chartData = buildChartData(jobs, receitas, chartPeriod);
  const sparkData = last30DaysSpark(jobs, receitas);

  // Regra de honestidade (#136): variação só com período anterior real e
  // diferente de zero; senão a pílula some, nunca um "0%" inventado.
  const now = new Date();
  const prevRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevSaldo =
    calcEarnings(jobs, receitas, "mes", prevRef) -
    monthExpenses(despesas, prevRef);
  const variacaoPct =
    prevSaldo !== 0 ? ((saldo - prevSaldo) / Math.abs(prevSaldo)) * 100 : null;
  const mesAnterior = prevRef.toLocaleDateString("pt-BR", { month: "long" });

  // Meta do mês: a mesma entrada do mês (calcEarnings "mes") sobre o alvo
  // mensal, com a mesma conta do MetasTab.
  const metaMes = monthMeta(metas);
  const metaPct =
    metaMes !== null && metaMes > 0
      ? progressoMeta(totalEntradaMes, metaMes)
      : null;

  const movimento = totalEntradaMes + totalDespMes;

  return (
    <div className="mb-5 flex flex-col gap-[10px]">
      <div className="grid grid-cols-2 gap-[10px] [&>:last-child:nth-child(even)]:col-span-2">
        <FinCard
          className="col-span-2 flex flex-col gap-[10px]"
          style={{ padding: "18px" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="font-semibold"
              style={{ fontSize: "12px", color: "var(--text-muted)" }}
            >
              Saldo do mês
            </span>
            {variacaoPct !== null && (
              <span
                className="flex items-center gap-1 font-bold rounded-full shrink-0"
                style={{
                  fontSize: "11px",
                  padding: "3px 9px",
                  // #175: verde/vermelho de texto pequeno.
                  color:
                    variacaoPct >= 0
                      ? "var(--success-text)"
                      : "var(--danger-text)",
                  background:
                    variacaoPct >= 0
                      ? "var(--success-tint)"
                      : "var(--danger-tint)",
                }}
              >
                {variacaoPct >= 0 ? (
                  <TrendingUp size={11} aria-hidden />
                ) : (
                  <TrendingDown size={11} aria-hidden />
                )}
                {variacaoPct >= 0 ? "+" : ""}
                {Math.round(variacaoPct)}% vs {mesAnterior}
              </span>
            )}
          </div>

          <strong
            className="font-extrabold tabular-nums leading-none"
            style={{
              fontSize: "36px",
              letterSpacing: "-1px",
              color: saldo >= 0 ? "var(--text)" : "var(--danger)",
            }}
          >
            {formatBRL(saldo)}
          </strong>

          {/* Barra entrou x saiu: proporção dos dois totais do mês, sem
              conta nova. Só aparece com movimento no mês. */}
          {movimento > 0 && (
            <div
              className="flex overflow-hidden"
              style={{
                height: "8px",
                gap: "3px",
                borderRadius: "var(--radius-pill)",
              }}
              aria-hidden
            >
              {totalEntradaMes > 0 && (
                <span
                  style={{
                    flex: totalEntradaMes,
                    background: "var(--success)",
                  }}
                />
              )}
              {totalDespMes > 0 && (
                <span
                  style={{ flex: totalDespMes, background: "var(--danger)" }}
                />
              )}
            </div>
          )}

          <div
            className="flex justify-between gap-2"
            style={{ fontSize: "11px", color: "var(--text-muted)" }}
          >
            <span>Entrou {formatBRL(totalEntradaMes)}</span>
            <span>Saiu {formatBRL(totalDespMes)}</span>
          </div>
        </FinCard>

        <FinCard className="flex flex-col gap-1.5" style={{ padding: "16px" }}>
          <TrendingUp
            size={20}
            style={{ color: "var(--success)" }}
            aria-hidden
          />
          <span
            className="font-semibold"
            style={{ fontSize: "11px", color: "var(--text-muted)" }}
          >
            Entradas
          </span>
          <span
            className="font-extrabold tabular-nums leading-none truncate"
            style={{ fontSize: "20px" }}
          >
            {formatBRL(totalEntradaMes)}
          </span>
        </FinCard>

        <FinCard className="flex flex-col gap-1.5" style={{ padding: "16px" }}>
          <TrendingDown
            size={20}
            style={{ color: "var(--danger)" }}
            aria-hidden
          />
          <span
            className="font-semibold"
            style={{ fontSize: "11px", color: "var(--text-muted)" }}
          >
            Saídas
          </span>
          <span
            className="font-extrabold tabular-nums leading-none truncate"
            style={{ fontSize: "20px" }}
          >
            {formatBRL(totalDespMes)}
          </span>
        </FinCard>

        {metaPct !== null && metaMes !== null && (
          <FinCard
            className="flex flex-col gap-1.5"
            style={{ padding: "16px" }}
          >
            <Target
              size={20}
              style={{ color: "var(--accent-deep)" }}
              aria-hidden
            />
            <span
              className="font-semibold"
              style={{ fontSize: "11px", color: "var(--text-muted)" }}
            >
              Meta
            </span>
            <span
              className="font-extrabold tabular-nums leading-none"
              style={{ fontSize: "20px" }}
            >
              {Math.round(metaPct)}%
            </span>
            <span
              className="truncate"
              style={{ fontSize: "10px", color: "var(--text-muted)" }}
            >
              {formatBRL(totalEntradaMes)} de {formatBRL(metaMes)}
            </span>
          </FinCard>
        )}
      </div>

      {/* Gráfico (preferência real de Ajustes, barras ou área). O seletor
          Semana/Mês/Ano só existe no modo barras: no modo área o gráfico é
          sempre os últimos 30 dias (last30DaysSpark) -- comportamento de
          antes, preservado. */}
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
    </div>
  );
}
