"use client";

import { formatBRL } from "@/lib/finance";
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
 * (acessibilidade, regra do J04). Cores do mockup (`--t-green`/`--t-red`).
 */
function Valor({ m, tamanho }: { m: Movement; tamanho: string }) {
  return (
    <span
      style={{
        fontSize: tamanho,
        fontWeight: 800,
        color: m.positive ? "var(--t-green)" : "var(--t-red)",
      }}
    >
      {m.positive ? "+" : "-"}
      {formatBRL(m.valor)}
    </span>
  );
}

const divisor = (i: number, total: number) =>
  i < total - 1 ? { borderBottom: "1px solid var(--t-line)" } : undefined;

const CARD = {
  background: "var(--t-card)",
  borderRadius: "20px",
  padding: "4px 16px",
} as const;

interface PropsVisao extends Props {
  /** "Extrato ›": leva pras listas completas (sub-abas, abaixo). */
  onExtrato?: () => void;
}

/**
 * Recentes e Mais lançamentos do Financeiro A, iguais ao mockup normativo
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html): valores de
 * estilo copiados de lá, cores pelas variáveis `--t-*`. Mesmas
 * movimentações de antes (`buildMovements`: atendimentos concluídos +
 * receitas + despesas, por data, as 10 mais recentes). Linhas só de
 * leitura. Devolve os blocos soltos: o espaçamento entre eles é o `gap`
 * de 12px da coluna do FinanceiroTab, como no mockup.
 */
export function VisaoTab({ jobs, despesas, receitas, onExtrato }: PropsVisao) {
  const movements = buildMovements(jobs, despesas, receitas);
  const recentes = movements.slice(0, QTD_RECENTES);
  const mais = movements.slice(QTD_RECENTES);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "4px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>
          Recentes
        </h2>
        {onExtrato && (
          <button
            type="button"
            onClick={onExtrato}
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--t-deep)",
              background: "none",
              border: 0,
              padding: 0,
            }}
          >
            Extrato ›
          </button>
        )}
      </div>
      <div style={CARD}>
        {recentes.length === 0 ? (
          <p
            className="text-center py-8"
            style={{ fontSize: "13px", color: "var(--t-mut)" }}
          >
            Nenhuma movimentação ainda.
          </p>
        ) : (
          recentes.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 0",
                ...divisor(i, recentes.length),
              }}
            >
              <span
                style={{
                  width: "44px",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--t-mut)",
                }}
              >
                {rotuloData(m.data, true)}
              </span>
              <div
                className="truncate"
                style={{
                  flexGrow: 1,
                  minWidth: 0,
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                {m.desc}
              </div>
              <Valor m={m} tamanho="13px" />
            </div>
          ))
        )}
      </div>

      {mais.length > 0 && (
        <>
          <h2 style={{ margin: "6px 0 0", fontSize: "15px", fontWeight: 800 }}>
            Mais lançamentos
          </h2>
          <section style={CARD}>
            {mais.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  ...divisor(i, mais.length),
                }}
              >
                <span
                  style={{
                    width: "40px",
                    height: "40px",
                    flexShrink: 0,
                    borderRadius: "12px",
                    background: "var(--t-soft)",
                    color: "var(--t-deep)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                  }}
                  aria-hidden
                >
                  {m.desc.charAt(0).toUpperCase()}
                </span>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div
                    className="truncate"
                    style={{ fontSize: "14px", fontWeight: 700 }}
                  >
                    {m.desc}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--t-mut)" }}>
                    {rotuloData(m.data, false)}
                  </div>
                </div>
                <Valor m={m} tamanho="14px" />
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
