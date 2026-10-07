"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  formatBRL,
  calcEarnings,
  monthExpenses,
  monthMeta,
  monthConcludedCount,
  monthEarnings,
  monthPaidJobsCount,
} from "@/lib/finance";
import type { Job, Despesa, Meta, ReceitaAvulsa } from "@/lib/types";
import { progressoMeta } from "./progressoMeta";

interface Props {
  jobs: Job[];
  receitas: ReceitaAvulsa[];
  despesas: Despesa[];
  totalEntradaMes: number;
  totalDespMes: number;
  saldo: number;
  metas: Meta[];
}

/**
 * Topo do Financeiro A, igual ao mockup normativo
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html, tela
 * Financeiro): o card "Saldo do mês" e a grade de 4 cards (Entradas,
 * Saídas, Meta, Ticket médio). Valores de estilo copiados do mockup, cores
 * pelas variáveis `--t-*` (as mesmas do mockup, em globals.css).
 *
 * Saldo e totais chegam prontos do FinanceiroTab e a variação é a de antes
 * (#136). Regras de exibição revistas por ordem do operador para o mockup
 * fechar inteiro (pixel do Financeiro, #209):
 *  - Meta: o faturamento do mês (atendimentos concluídos pelo dia do
 *    atendimento, o mesmo número do card principal do Início) sobre a meta;
 *  - Ticket médio: o que entrou no mês ÷ atendimentos concluídos no mês;
 *  - "N lançamentos" de Entradas: atendimentos cujo dinheiro entrou no mês
 *    (`diaDoDinheiro`) + receitas avulsas do mês.
 *
 * O gráfico (preferência de Ajustes) não está no mockup: mora em
 * FinanceiroGrafico, abaixo dos lançamentos.
 */

/** Card do mockup: `background:var(--t-card);color:var(--t-ink);
 * border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:6px` */
const CARD: CSSProperties = {
  background: "var(--t-card)",
  color: "var(--t-ink)",
  borderRadius: "20px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const ROTULO: CSSProperties = {
  fontSize: "11px",
  color: "var(--t-mut)",
  fontWeight: 600,
};
const VALOR: CSSProperties = { fontSize: "20px", fontWeight: 800 };
const APOIO: CSSProperties = { fontSize: "10px", color: "var(--t-mut)" };

/** Ícone do mockup: 20×20, traço 2, cor do wrapper. */
function Icone({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span style={{ color: cor }}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        // Inline como no mockup (o preflight do Tailwind deixa svg em
        // bloco, o que encolhe a linha do ícone).
        style={{ display: "inline", verticalAlign: "baseline" }}
      >
        {children}
      </svg>
    </span>
  );
}

function plural(n: number): string {
  return `${n} ${n === 1 ? "lançamento" : "lançamentos"}`;
}

export function FinanceiroHeroCard({
  jobs,
  receitas,
  despesas,
  totalEntradaMes,
  totalDespMes,
  saldo,
  metas,
}: Props) {
  const now = new Date();
  const prevRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevSaldo =
    calcEarnings(jobs, receitas, "mes", prevRef) -
    monthExpenses(despesas, prevRef);
  const variacaoPct =
    prevSaldo !== 0 ? ((saldo - prevSaldo) / Math.abs(prevSaldo)) * 100 : null;
  const mesAnterior = prevRef.toLocaleDateString("pt-BR", { month: "long" });

  const metaMes = monthMeta(metas);
  const faturamento = monthEarnings(jobs, now);
  const metaPct =
    metaMes !== null && metaMes > 0
      ? progressoMeta(faturamento, metaMes)
      : null;

  const noMes = (data: string) => {
    const d = new Date(`${data}T00:00:00`);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  };
  const atendimentosMes = monthConcludedCount(jobs, now);
  const qtdEntradas =
    monthPaidJobsCount(jobs, now) +
    receitas.filter((r) => noMes(r.data)).length;
  const qtdSaidas = despesas.filter((d) => noMes(d.data)).length;
  // Ticket médio = o que entrou no mês ÷ atendimentos concluídos no mês.
  const ticketMedio =
    atendimentosMes > 0 ? Math.round(totalEntradaMes / atendimentosMes) : null;

  const movimento = totalEntradaMes + totalDespMes;
  const sobe = variacaoPct !== null && variacaoPct >= 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "10px",
        marginTop: "6px",
      }}
    >
      <section
        style={{ ...CARD, gridColumn: "span 2", padding: "18px", gap: "10px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{ fontSize: "12px", fontWeight: 600, color: "var(--t-mut)" }}
          >
            Saldo do mês
          </span>
          {variacaoPct !== null && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: "999px",
                background: sobe ? "var(--t-gsoft)" : "var(--t-rsoft)",
                color: sobe ? "var(--t-green)" : "var(--t-red)",
              }}
            >
              {/* Um nó de texto só, como no mockup: o navegador espaça a
                  junção de dois nós de forma diferente (ordem do operador:
                  pixel idêntico). */}
              {`${sobe ? "+" : ""}${Math.round(variacaoPct)}% vs ${mesAnterior}`}
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: "36px",
            fontWeight: 800,
            letterSpacing: "-1px",
            color: saldo >= 0 ? undefined : "var(--t-red)",
          }}
        >
          {formatBRL(saldo)}
        </span>

        {/* Barra entrou x saiu: proporção dos dois totais do mês. */}
        {movimento > 0 && (
          <div
            style={{
              display: "flex",
              height: "8px",
              borderRadius: "4px",
              overflow: "hidden",
              gap: "3px",
            }}
            aria-hidden
          >
            {totalEntradaMes > 0 && (
              <span
                style={{ flex: totalEntradaMes, background: "var(--t-green)" }}
              />
            )}
            {totalDespMes > 0 && (
              <span
                style={{ flex: totalDespMes, background: "var(--t-red)" }}
              />
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--t-mut)",
          }}
        >
          <span>Entrou {formatBRL(totalEntradaMes)}</span>
          <span>Saiu {formatBRL(totalDespMes)}</span>
        </div>
      </section>

      <section style={CARD}>
        <Icone cor="var(--t-green)">
          <path d="M7 17 17 7M7 7h10v10" />
        </Icone>
        <span style={ROTULO}>Entradas</span>
        <span style={VALOR}>{formatBRL(totalEntradaMes)}</span>
        <span style={APOIO}>{plural(qtdEntradas)}</span>
      </section>

      <section style={CARD}>
        <Icone cor="var(--t-red)">
          <path d="M17 7 7 17M17 17H7V7" />
        </Icone>
        <span style={ROTULO}>Saídas</span>
        <span style={VALOR}>{formatBRL(totalDespMes)}</span>
        <span style={APOIO}>{plural(qtdSaidas)}</span>
      </section>

      {metaPct !== null && metaMes !== null && (
        <section style={CARD}>
          <Icone cor="var(--t-deep)">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </Icone>
          <span style={ROTULO}>Meta</span>
          <span style={VALOR}>{`${Math.round(metaPct)}%`}</span>
          <span style={APOIO}>
            {formatBRL(faturamento)} de {formatBRL(metaMes)}
          </span>
        </section>
      )}

      {ticketMedio !== null && (
        <section style={CARD}>
          <Icone cor="var(--t-deep)">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </Icone>
          <span style={ROTULO}>Ticket médio</span>
          <span style={VALOR}>{formatBRL(ticketMedio)}</span>
          <span style={APOIO}>por atendimento</span>
        </section>
      )}
    </div>
  );
}
