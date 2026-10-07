"use client";

import { formatBRL, monthProjection } from "@/lib/finance";
import type { Job, Meta } from "@/lib/types";
import { InicioCard } from "./InicioCard";

interface Props {
  jobs: Job[];
  metas: Meta[];
  onGoToFinanceiro: () => void;
}

/**
 * O card principal da Início no visual novo (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`): "Faturamento · <mês>", a pílula com
 * o percentual da meta, o valor do mês em destaque, "de <meta>", a barra e
 * a linha de projeção. Todos os números vêm de `monthProjection` -- a
 * mesma conta de antes, nenhuma nova. O card inteiro é tocável e leva ao
 * Financeiro (Visão), o mesmo destino do antigo botão do card (#134).
 */
export function HeroCard({ jobs, metas, onGoToFinanceiro }: Props) {
  const p = monthProjection(jobs, metas);

  const etaLabel = p.metaEta
    ? p.metaEta.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
    : null;

  let projecao: string | null;
  if (p.isEmpty) {
    projecao = "Registre seu primeiro atendimento e veja sua projeção começar.";
  } else if (p.meta !== null) {
    if (p.remaining !== null && p.remaining > 0) {
      projecao = etaLabel
        ? `No seu ritmo, você chega lá até ${etaLabel}.`
        : null;
    } else {
      projecao = `Você alcançou ${formatBRL(p.meta)} este mês — no seu ritmo.`;
    }
  } else {
    projecao = `No seu ritmo, você chega em ${formatBRL(
      p.projectedMonthEnd
    )} até o fim de ${p.monthLabel}.`;
  }

  // Valores do mockup normativo: `padding:18px; gap:10px`, pílula
  // `--t-soft`/`--t-deep`, valor 36px/800 (-1px), barra 8px raio 4.
  return (
    <InicioCard
      onClick={onGoToFinanceiro}
      style={{
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
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
          style={{ fontSize: "12px", fontWeight: 600, color: "var(--t-mut)" }}
        >
          {`Faturamento · ${p.monthLabel}`}
        </span>
        {p.pct !== null && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: "999px",
              background: "var(--t-soft)",
              color: "var(--t-deep)",
              flexShrink: 0,
            }}
          >
            {`${Math.round(p.pct)}% da meta`}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span
          style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px" }}
        >
          {formatBRL(p.earned)}
        </span>
        {p.meta !== null && (
          <span style={{ fontSize: "13px", color: "var(--t-mut)" }}>
            {`de ${formatBRL(p.meta)}`}
          </span>
        )}
      </div>

      {!p.isEmpty && (
        <div
          style={{
            height: "8px",
            borderRadius: "4px",
            background: "var(--t-soft)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round(p.barFraction * 100)}%`,
              height: "8px",
              background: "var(--t-acc)",
              borderRadius: "4px",
            }}
          />
        </div>
      )}

      {projecao && (
        <div style={{ fontSize: "11px", color: "var(--t-mut)" }}>
          {projecao}
        </div>
      )}
    </InicioCard>
  );
}
