"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatBRL, formatShortDate } from "@/lib/finance";
import type { Job, Despesa, ReceitaAvulsa } from "@/lib/types";

interface Movement {
  id: string;
  desc: string;
  valor: number;
  data: string;
  positive: boolean;
}

/**
 * Movimentações recentes — 100% dado real (jobs concluídos + receitas
 * avulsas + despesas), nunca as 3 linhas fixas que o protótipo usa como
 * ilustração (um atendimento, uma assinatura, outro atendimento). Só
 * leitura: ao
 * contrário do protótipo (onde tocar uma linha abre o sheet "novo-movimento"
 * pra editar), aqui não há um fluxo real de "editar movimentação genérica"
 * — jobs se editam pela Agenda, despesas/receitas pelas próprias sub-abas
 * Entradas/Saídas (listar/criar/excluir, preservadas intactas). Inventar
 * um clique que leva a lugar nenhum seria pior que não ter clique nenhum;
 * por isso as linhas são `<div>`, não `<button>`.
 */
function buildMovements(
  jobs: Job[],
  despesas: Despesa[],
  receitas: ReceitaAvulsa[]
): Movement[] {
  const jobM: Movement[] = jobs
    .filter((j) => j.status === "concluído")
    .map((j) => ({
      id: `job-${j.id}`,
      desc: j.clienteNome,
      valor: j.valor,
      data: j.data,
      positive: true,
    }));
  const recM: Movement[] = receitas.map((r) => ({
    id: `rec-${r.id}`,
    desc: r.descricao,
    valor: r.valor,
    data: r.data,
    positive: true,
  }));
  const despM: Movement[] = despesas.map((d) => ({
    id: `desp-${d.id}`,
    desc: d.descricao,
    valor: d.valor,
    data: d.data,
    positive: false,
  }));
  return [...jobM, ...recM, ...despM]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 10);
}

interface Props {
  jobs: Job[];
  despesas: Despesa[];
  receitas: ReceitaAvulsa[];
}

export function VisaoTab({ jobs, despesas, receitas }: Props) {
  const movements = buildMovements(jobs, despesas, receitas);

  // Fundação Visual (#142): sem `style` — material neutro compartilhado de
  // `.glass-card` (globals.css), mesmo padrão já convergido em Início
  // (achado #131, ver HeroCard.tsx) — o `SOLID_SURFACE_STYLE` local que
  // existia aqui sobrescrevia com `border: var(--border-color)`, tingido
  // por tema (contorno rosa nos temas de acento), a mesma causa-raiz já
  // corrigida lá.
  return (
    <GlassCard radius="md" className="p-4">
      <p
        className="font-semibold mb-1"
        style={{
          fontSize: "13px",
          letterSpacing: "-0.035em",
          color: "var(--text)",
        }}
      >
        Movimentações recentes
      </p>

      {movements.length === 0 ? (
        <p
          className="text-sm text-center py-8"
          style={{ color: "var(--text-muted)" }}
        >
          Nenhuma movimentação ainda.
        </p>
      ) : (
        <div className="mt-2">
          {movements.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center gap-3 py-3"
              style={{
                borderBottom:
                  i === movements.length - 1
                    ? "none"
                    : "1px solid var(--border-color)",
              }}
            >
              <div
                className="shrink-0 grid place-items-center rounded-full"
                style={{
                  width: 39,
                  height: 39,
                  background: m.positive
                    ? "rgb(var(--success-rgb) / 0.13)"
                    : "rgb(var(--danger-rgb) / 0.12)",
                  border: `1px solid ${
                    m.positive
                      ? "rgb(var(--success-rgb) / 0.25)"
                      : "rgb(var(--danger-rgb) / 0.2)"
                  }`,
                }}
              >
                {m.positive ? (
                  <ArrowUpRight size={18} style={{ color: "var(--success)" }} />
                ) : (
                  <ArrowDownRight
                    size={18}
                    style={{ color: "var(--danger)" }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-sm truncate"
                  style={{ color: "var(--text)" }}
                >
                  {m.desc}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatShortDate(m.data)}
                </p>
              </div>
              <strong
                className="text-sm tabular-nums shrink-0"
                style={{
                  color: m.positive ? "var(--success)" : "var(--danger)",
                }}
              >
                {m.positive ? "+" : "-"}
                {formatBRL(m.valor)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
