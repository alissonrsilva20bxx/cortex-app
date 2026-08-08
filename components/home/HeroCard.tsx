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
 * Superfície sólida e legível (sem blur), como no laboratório visual —
 * `.jobapp-visual-launch` reserva o vidro pra navegação/sheets e usa
 * superfícies mais sólidas em cards de conteúdo. Repetido por arquivo
 * (não extraído pra um helper compartilhado) porque o escopo deste
 * ticket é só estes 4 componentes de Início — nada em `components/ui/`.
 *
 * `border` sobrescreve a borda cor-de-destaque de `.glass-card`
 * (globals.css) por uma neutra — mais perto do `border-white/[0.075]`
 * do laboratório. Uma coisa que o `style` inline NÃO alcança:
 * `.glass-card::before` (o "shine" — gradiente translúcido) continua
 * pintando por cima, porque pseudo-elemento não é afetado por inline
 * style. Removê-lo exigiria editar `components/ui/GlassCard.tsx` ou o
 * `.glass-card` global, fora do escopo permitido deste ticket — fica
 * registrado como resíduo aceito, não como fidelidade completa.
 */
const SOLID_SURFACE_STYLE = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
  border: "1px solid var(--border-color)",
  boxShadow:
    "inset 0 1px 0 rgb(255 255 255 / 0.035), 0 10px 30px rgb(0 0 0 / 0.18)",
} as const;

/**
 * O card-herói: a projeção viva das metas. Peça central da Home e o
 * diferencial defensável do app — mostra "o quanto ela já construiu" e,
 * no ritmo dela, aonde isso chega. Enquadramento sempre empoderador,
 * nunca de saída.
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
      radius="lg"
      onClick={onGoToFinanceiro}
      ariaLabel="Ver detalhes financeiros"
      className="p-6"
      style={SOLID_SURFACE_STYLE}
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

      {/* Valor — protagonista da tela (Início: "resumo financeiro como
          protagonista"), mas o brilho fica discreto — a disciplina Apple
          reserva neon pra seleção/progresso/ação primária, não pra todo
          texto de destaque. */}
      <p
        className="font-semibold tabular-nums leading-none"
        style={{
          fontSize: "30px",
          letterSpacing: "-0.065em",
          color: "var(--accent)",
          textShadow: "0 0 20px rgb(var(--accent-rgb) / 0.28)",
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
