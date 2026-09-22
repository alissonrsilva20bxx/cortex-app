"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MiniBarChart } from "@/components/charts/MiniBarChart";
import { AreaSparkline } from "@/components/charts/AreaSparkline";
import {
  formatBRL,
  calcEarnings,
  monthExpenses,
  buildChartData,
  last30DaysSpark,
  type ChartPeriod,
} from "@/lib/finance";
import type { Job, Despesa, ReceitaAvulsa } from "@/lib/types";

const PERIOD_OPTS: { id: ChartPeriod; label: string }[] = [
  { id: "sem", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
];

/**
 * Superfície sólida (sem blur), mesmo padrão já estabelecido em Início
 * (T2), Agenda (T3) e no resto de Financeiro (T4). Repetido aqui (não
 * extraído pra `components/ui/`) porque o escopo deste ticket é só os
 * arquivos de `components/financeiro/`.
 */
const SOLID_SURFACE_STYLE = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
  border: "1px solid var(--border-color)",
  boxShadow:
    "inset 0 1px 0 rgb(255 255 255 / 0.035), 0 10px 30px rgb(0 0 0 / 0.18)",
} as const;

interface Props {
  jobs: Job[];
  receitas: ReceitaAvulsa[];
  despesas: Despesa[];
  totalEntradaMes: number;
  totalDespMes: number;
  saldo: number;
  /** Preferência real de gráfico (Ajustes) — mesma prop que o Financeiro
   * já recebia antes desta ticket, agora só reposicionada pro hero. */
  chartType?: "bar" | "area";
}

/**
 * Card-herói unificado de saldo (issue #136, composição de
 * /dev-preview/ios) — substitui os 3 cards separados (Entradas/Saídas/
 * Saldo) que existiam em VisaoTab.tsx por um único card com o saldo,
 * o selo de variação, a divisão entradas/saídas e o gráfico, sempre
 * visível acima das 4 sub-abas (Visão/Entradas/Saídas/Metas) — como no
 * protótipo, onde o `balanceCard` fica fora do `{activeSegment === ...}`.
 *
 * **Regra de honestidade — variação só com período anterior real**: o
 * protótipo mostra um selo de variação fixo e sempre positivo. Aqui,
 * `variacaoPct` só existe quando
 * `prevSaldo !== 0` — um saldo-base de R$0 no mês anterior torna a
 * variação percentual matematicamente indefinida (divisão por zero),
 * não "0% de variação real"; nesse caso (inclusive quando não há
 * nenhum dado no mês anterior, que também resulta em prevSaldo = 0) o
 * selo é omitido inteiramente, nunca substituído por um número
 * inventado ou um "0%" enganoso.
 */
export function FinanceiroHeroCard({
  jobs,
  receitas,
  despesas,
  totalEntradaMes,
  totalDespMes,
  saldo,
  chartType = "bar",
}: Props) {
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("sem");
  const chartData = buildChartData(jobs, receitas, chartPeriod);
  const sparkData = last30DaysSpark(jobs, receitas);

  const now = new Date();
  const prevRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevSaldo =
    calcEarnings(jobs, receitas, "mes", prevRef) -
    monthExpenses(despesas, prevRef);
  const variacaoPct =
    prevSaldo !== 0 ? ((saldo - prevSaldo) / Math.abs(prevSaldo)) * 100 : null;

  return (
    <div className="mb-5">
      {/* Barra "Resumo financeiro" + seletor Semana/Mês/Ano — posição e
          estilo do protótipo (acima do card-herói, não dentro dele).
          O seletor só aparece no modo "bar": no modo "área" o gráfico é
          sempre os últimos 30 dias (last30DaysSpark, sem bucket por
          período) — mesmo comportamento condicional que já existia em
          VisaoTab.tsx antes desta ticket, preservado aqui. */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span
          className="font-semibold"
          style={{ fontSize: "11px", color: "var(--text-muted)" }}
        >
          Resumo financeiro
        </span>
        {chartType !== "area" && (
          <SegmentedControl
            size="sm"
            options={PERIOD_OPTS}
            value={chartPeriod}
            onChange={setChartPeriod}
          />
        )}
      </div>

      <GlassCard radius="lg" className="p-5" style={SOLID_SURFACE_STYLE}>
        <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Saldo do mês
        </p>
        <div className="flex items-center gap-2.5 mt-1.5">
          <strong
            className="tabular-nums leading-none"
            style={{
              fontSize: "32px",
              letterSpacing: "-0.04em",
              color: saldo >= 0 ? "var(--accent)" : "var(--danger)",
              textShadow:
                saldo >= 0
                  ? "0 0 18px rgb(var(--accent-rgb) / 0.4)"
                  : "0 0 18px rgb(var(--danger-rgb) / 0.4)",
            }}
          >
            {formatBRL(saldo, 2)}
          </strong>
          {variacaoPct !== null && (
            <span
              className="flex items-center gap-1 font-bold rounded-full shrink-0"
              style={{
                fontSize: "11px",
                padding: "4px 8px",
                color: variacaoPct >= 0 ? "var(--success)" : "var(--danger)",
                background:
                  variacaoPct >= 0
                    ? "rgb(var(--success-rgb) / 0.12)"
                    : "rgb(var(--danger-rgb) / 0.12)",
              }}
            >
              {variacaoPct >= 0 ? (
                <TrendingUp size={11} />
              ) : (
                <TrendingDown size={11} />
              )}
              {variacaoPct >= 0 ? "+" : ""}
              {Math.round(variacaoPct)}%
            </span>
          )}
        </div>

        <div
          className="grid grid-cols-2 gap-4 mt-4 pt-4"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Entradas
            </p>
            <strong
              className="tabular-nums block mt-0.5"
              style={{ fontSize: "16px", color: "var(--success)" }}
            >
              {formatBRL(totalEntradaMes)}
            </strong>
          </div>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Saídas
            </p>
            <strong
              className="tabular-nums block mt-0.5"
              style={{ fontSize: "16px", color: "var(--danger)" }}
            >
              {formatBRL(totalDespMes)}
            </strong>
          </div>
        </div>

        {/* Gráfico de linha (protótipo) — `AreaSparkline` já é isso: uma
            linha com preenchimento em gradiente sob `var(--accent)`,
            tema real, nada hardcoded. `MiniBarChart` continua a opção
            "Barras" da mesma preferência real de Ajustes; nenhuma das
            duas foi inventada nesta ticket. */}
        <div className="mt-4">
          {chartType === "area" ? (
            <AreaSparkline data={sparkData} height={100} id="fin-hero-area" />
          ) : (
            <MiniBarChart data={chartData} height={100} id="fin-hero-bar" />
          )}
        </div>
      </GlassCard>
    </div>
  );
}
