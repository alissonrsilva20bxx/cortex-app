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

  // Uma linha só de projeção, no tom de aliada serena. Mesmos textos que o
  // card já usava em cada situação.
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

  return (
    <InicioCard
      onClick={onGoToFinanceiro}
      className="flex flex-col gap-[10px]"
      style={{ padding: "18px" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-semibold"
          style={{ fontSize: "12px", color: "var(--text-muted)" }}
        >
          Faturamento · {p.monthLabel}
        </span>
        {p.pct !== null && (
          <span
            className="font-bold rounded-full shrink-0"
            style={{
              fontSize: "11px",
              padding: "3px 9px",
              background: "var(--accent-tint)",
              color: "var(--accent-deep)",
            }}
          >
            {Math.round(p.pct)}% da meta
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="font-extrabold tabular-nums leading-none"
          style={{ fontSize: "36px", letterSpacing: "-1px" }}
        >
          {formatBRL(p.earned)}
        </span>
        {p.meta !== null && (
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            de {formatBRL(p.meta)}
          </span>
        )}
      </div>

      {!p.isEmpty && (
        <div
          className="overflow-hidden"
          style={{
            height: "8px",
            borderRadius: "var(--radius-pill)",
            background: "var(--accent-tint)",
          }}
        >
          <div
            style={{
              width: `${Math.round(p.barFraction * 100)}%`,
              height: "8px",
              borderRadius: "var(--radius-pill)",
              background: "var(--accent)",
            }}
          />
        </div>
      )}

      {projecao && (
        <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {projecao}
        </p>
      )}
    </InicioCard>
  );
}
