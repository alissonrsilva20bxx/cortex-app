"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { Job, Despesa } from "@/lib/types";

interface Props {
  jobs: Job[];
  despesas: Despesa[];
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

function monthExpenses(despesas: Despesa[]): number {
  const now = new Date();
  return despesas
    .filter((d) => {
      const date = new Date(d.data + "T00:00:00");
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    })
    .reduce((s, d) => s + d.valor, 0);
}

export function ReceitaDespesaCards({
  jobs,
  despesas,
  onGoToFinanceiro,
}: Props) {
  const receita = monthEarnings(jobs);
  const despesa = monthExpenses(despesas);
  const lucro = receita - despesa;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Receita */}
      <button
        onClick={onGoToFinanceiro}
        className="rounded-[18px] p-4 text-left transition-all active:scale-[0.95]"
        style={{
          background:
            "linear-gradient(135deg, rgba(80,220,120,0.1) 0%, rgba(80,220,120,0.02) 100%)",
          border: "1.5px solid rgba(80,220,120,0.2)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: "rgba(80,220,120,0.15)" }}
          >
            <TrendingUp size={16} style={{ color: "#50dc78" }} />
          </div>
        </div>
        <p
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Receitas
        </p>
        <p
          className="font-black mt-1"
          style={{
            fontSize: "18px",
            color: "#50dc78",
            letterSpacing: "-0.02em",
          }}
        >
          {formatBRL(receita)}
        </p>
      </button>

      {/* Despesa */}
      <button
        onClick={onGoToFinanceiro}
        className="rounded-[18px] p-4 text-left transition-all active:scale-[0.95]"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,100,80,0.1) 0%, rgba(255,100,80,0.02) 100%)",
          border: "1.5px solid rgba(255,100,80,0.2)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: "rgba(255,100,80,0.15)" }}
          >
            <TrendingDown size={16} style={{ color: "#ff6450" }} />
          </div>
        </div>
        <p
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Despesas
        </p>
        <p
          className="font-black mt-1"
          style={{
            fontSize: "18px",
            color: "#ff6450",
            letterSpacing: "-0.02em",
          }}
        >
          {formatBRL(despesa)}
        </p>
      </button>
    </div>
  );
}
