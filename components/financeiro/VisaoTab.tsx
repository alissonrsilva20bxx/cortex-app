"use client";

import { formatBRL } from "@/lib/finance";
import type { Job, Despesa, ReceitaAvulsa } from "@/lib/types";
import { FinCard } from "./FinCard";

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

/** Quantas movimentações ficam em "Recentes"; o resto vai pra "Mais lançamentos". */
const QTD_RECENTES = 3;

/**
 * "22 SET" (maiúsculo) ou "22 set." -- dia + mês curto, sempre no fuso
 * local: a data vem como "YYYY-MM-DD" e é lida com "T00:00:00", nunca via
 * toISOString/UTC (bug já corrigido aqui uma vez, em Despesa/Receita).
 */
function rotuloData(data: string, maiusculo: boolean): string {
  const d = new Date(`${data}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const mes = d.toLocaleDateString("pt-BR", { month: "short" });
  const dia = String(d.getDate()).padStart(2, "0");
  return maiusculo
    ? `${dia} ${mes.replace(".", "").toUpperCase()}`
    : `${dia} ${mes}`;
}

/**
 * Valor com sinal no texto: entrada x saída nunca depende só da cor
 * (acessibilidade, regra do J04).
 */
function Valor({ m, tamanho }: { m: Movement; tamanho: string }) {
  return (
    <strong
      className="font-extrabold tabular-nums shrink-0"
      style={{
        fontSize: tamanho,
        color: m.positive ? "var(--success)" : "var(--danger)",
      }}
    >
      {m.positive ? "+" : "-"}
      {formatBRL(m.valor)}
    </strong>
  );
}

const divisor = (i: number, total: number) =>
  i < total - 1 ? { borderBottom: "1px solid var(--card-border)" } : undefined;

/**
 * Sub-aba Visão no visual novo (Jornada J04, mockup
 * `5-telas-8-temas-claro-escuro.html`): "Recentes" (as 3 movimentações
 * mais novas) e "Mais lançamentos" (as seguintes). Mesmas movimentações de
 * antes (`buildMovements`: atendimentos concluídos + receitas + despesas,
 * por data, as 10 mais recentes). Linhas só de leitura.
 */
export function VisaoTab({ jobs, despesas, receitas }: Props) {
  const movements = buildMovements(jobs, despesas, receitas);
  const recentes = movements.slice(0, QTD_RECENTES);
  const mais = movements.slice(QTD_RECENTES);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-extrabold" style={{ fontSize: "15px" }}>
        Recentes
      </h2>
      <FinCard style={{ padding: "4px 16px" }}>
        {recentes.length === 0 ? (
          <p
            className="text-sm text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhuma movimentação ainda.
          </p>
        ) : (
          recentes.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center gap-3"
              style={{ padding: "11px 0", ...divisor(i, recentes.length) }}
            >
              <span
                className="font-bold shrink-0"
                style={{
                  width: "48px",
                  whiteSpace: "nowrap",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                }}
              >
                {rotuloData(m.data, true)}
              </span>
              <p
                className="flex-1 min-w-0 font-bold truncate"
                style={{ fontSize: "13px" }}
              >
                {m.desc}
              </p>
              <Valor m={m} tamanho="13px" />
            </div>
          ))
        )}
      </FinCard>

      {mais.length > 0 && (
        <>
          <h2 className="font-extrabold mt-1.5" style={{ fontSize: "15px" }}>
            Mais lançamentos
          </h2>
          <FinCard style={{ padding: "4px 16px" }}>
            {mais.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center gap-3 py-3"
                style={divisor(i, mais.length)}
              >
                <span
                  className="grid place-items-center shrink-0 font-extrabold"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--accent-tint)",
                    color: "var(--accent-deep)",
                  }}
                  aria-hidden
                >
                  {m.desc.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-bold truncate"
                    style={{ fontSize: "14px" }}
                  >
                    {m.desc}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {rotuloData(m.data, false)}
                  </p>
                </div>
                <Valor m={m} tamanho="14px" />
              </div>
            ))}
          </FinCard>
        </>
      )}
    </div>
  );
}
