"use client";

import { ArrowUpRight, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatBRL, monthProjection } from "@/lib/finance";
import type { Job, Meta } from "@/lib/types";

interface Props {
  jobs: Job[];
  metas: Meta[];
  onGoToFinanceiro: () => void;
}

/**
 * O card-herói: a projeção viva das metas. Peça central da Home e o
 * diferencial defensável do app — mostra "o quanto ela já construiu" e,
 * no ritmo dela, aonde isso chega. Único lugar onde o neon brilha
 * (valor + barra). Enquadramento sempre empoderador, nunca de saída.
 */
export function HeroCard({ jobs, metas, onGoToFinanceiro }: Props) {
  const p = monthProjection(jobs, metas);

  const etaLabel = p.metaEta
    ? p.metaEta.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
    : null;

  // Projeção em duas leituras, no tom de aliada serena.
  let primary: string;
  let secondary: string | null = null;

  if (p.isEmpty) {
    primary = "Registre seu primeiro atendimento e veja sua projeção começar.";
  } else if (p.meta !== null) {
    if (p.remaining !== null && p.remaining > 0) {
      primary = `Faltam ${formatBRL(p.remaining)} para ${formatBRL(p.meta)}.`;
      secondary = etaLabel
        ? `No seu ritmo, você chega lá até ${etaLabel}.`
        : null;
    } else {
      primary = `Você alcançou ${formatBRL(p.meta)} este mês — no seu ritmo.`;
    }
  } else {
    primary = `No seu ritmo, você chega em ${formatBRL(
      p.projectedMonthEnd
    )} até o fim de ${p.monthLabel}.`;
    secondary = "Defina uma meta para acompanhar de perto.";
  }

  return (
    <GlassCard
      radius="xl"
      onClick={onGoToFinanceiro}
      ariaLabel="Ver detalhes financeiros"
      className="p-6"
    >
      {/* Rótulo + chip "no seu ritmo" */}
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Você já construiu</p>
        <span
          className="flex items-center gap-1 font-semibold rounded-full px-2.5 py-1"
          style={{
            fontSize: "11px",
            background: "rgb(var(--accent-rgb) / 0.12)",
            color: "var(--accent)",
            border: "1px solid rgb(var(--accent-rgb) / 0.22)",
          }}
        >
          <ArrowUpRight size={12} />
          no seu ritmo
        </span>
      </div>

      {/* Valor — o momento herói (único neon de texto) */}
      <p
        className="font-black tabular-nums leading-none"
        style={{
          fontSize: "40px",
          letterSpacing: "-0.04em",
          color: "var(--accent)",
          textShadow: "0 0 32px rgb(var(--accent-rgb) / 0.55)",
        }}
      >
        {formatBRL(p.earned)}
        <span
          className="font-semibold"
          style={{ fontSize: "14px", color: "var(--text-muted)" }}
        >
          {" "}
          este mês
        </span>
      </p>

      {/* Projeção viva — duas leituras */}
      <div className="mt-4">
        <p
          className="font-semibold leading-snug"
          style={{ fontSize: "15px", color: "var(--text)" }}
        >
          {primary}
        </p>
        {secondary && (
          <p
            className="font-medium mt-1 leading-snug"
            style={{ fontSize: "13px", color: "var(--text-2)" }}
          >
            {secondary}
          </p>
        )}
      </div>

      {/* Barra que anda a cada atendimento (neon disciplinado) */}
      {!p.isEmpty && (
        <div className="mt-5">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.round(p.barFraction * 100)}%` }}
            />
          </div>
          {p.pct !== null && (
            <div className="flex items-center justify-between mt-2">
              <span
                className="font-semibold tabular-nums"
                style={{ fontSize: "11px", color: "var(--text-2)" }}
              >
                {Math.round(p.pct)}% da meta
              </span>
              <span
                className="flex items-center gap-0.5 font-medium"
                style={{ fontSize: "11px", color: "var(--text-muted)" }}
              >
                ver financeiro
                <ChevronRight size={12} />
              </span>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
