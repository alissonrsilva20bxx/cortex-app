"use client";

import { ChevronRight, Target } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatBRL, monthProjection } from "@/lib/finance";
import type { Job, Meta } from "@/lib/types";

/** Geometria do anel — raio 37 (mesmo do laboratório: circunferência 232.5). */
const RING_RADIUS = 37;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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
 *
 * Nota de escopo: o card-herói do laboratório também tem um recorte
 * "Entrou este mês / Saiu este mês" (entradas/saídas, page.tsx:336-351).
 * Não portado aqui — este componente só recebe `jobs`/`metas`, sem
 * despesas/receitas avulsas; calcular esse split exigiria lógica nova em
 * `lib/finance.ts` e fiação nova em `app/page.tsx`, ambos fora da lista
 * de arquivos permitidos deste ticket (T2/#29). Registrado como
 * pendência de produto, não implementado.
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

  // Mesma leitura em dois lugares (anel + barra fina): rumo à meta se
  // houver, senão rumo ao projetado — igual à barra de baixo, sem
  // inventar um segundo número. 100% real: p.pct/p.barFraction, nunca
  // um valor fixo.
  const ringFraction = p.pct !== null ? p.pct / 100 : p.barFraction;
  const ringOffset = RING_CIRCUMFERENCE * (1 - Math.min(1, ringFraction));

  return (
    <GlassCard
      radius="lg"
      onClick={onGoToFinanceiro}
      ariaLabel="Ver detalhes financeiros"
      className="p-5"
      style={SOLID_SURFACE_STYLE}
    >
      {/* Duas colunas — valor à esquerda, anel de progresso à direita —
          mesma composição do card-herói do laboratório (page.tsx:282-330,
          grid-cols-[1fr_92px]). O anel usa a MESMA fração real que a
          barra fina abaixo (p.pct ou p.barFraction); não é decorativo. */}
      <div className="grid grid-cols-[1fr_86px] items-center gap-4">
        <div className="min-w-0">
          {/* Legenda do card-herói — sentence case, 11px/medium, -0.015em,
              texto a 55% de opacidade, como no laboratório
              (app/dev-preview/launch/page.tsx, bloco "home"). NÃO é
              `.section-label`: aquele eyebrow em caixa-alta com tracking
              positivo (10.5px/700/0.1em/uppercase) não é usado em nenhum
              header da tela Início no laboratório — era a causa raiz de
              PR #41 ter sido reprovada por "ainda parecer o app antigo". */}
          <p
            className="font-medium"
            style={{
              fontSize: "11px",
              letterSpacing: "-0.015em",
              color: "color-mix(in srgb, var(--text) 55%, transparent)",
            }}
          >
            Você já construiu
          </p>
          <p
            className="font-medium mt-0.5"
            style={{ fontSize: "11px", color: "var(--text-muted)" }}
          >
            {p.monthLabel} · no seu ritmo
          </p>

          {/* Valor — protagonista da tela (Início: "resumo financeiro
              como protagonista"), mas o brilho fica discreto — a
              disciplina Apple reserva neon pra seleção/progresso/ação
              primária, não pra todo texto de destaque. Número e
              tracking literais do laboratório (page.tsx:291-296).
              Hierarquia igual à do laboratório: quando há meta, o
              número gigante é o PERCENTUAL (não o valor em reais) — o
              real vem como legenda menor embaixo, igual ao "R$ 4.860
              de R$ 6.750,00" do laboratório. Sem meta não há percentual
              real pra mostrar (p.pct é null), então o valor em reais
              volta a ser o protagonista — nunca um % inventado. */}
          <p
            className="font-semibold tabular-nums leading-none mt-2"
            style={{
              fontSize: "30px",
              letterSpacing: "-0.065em",
              color: "var(--accent)",
              textShadow: "0 0 20px rgb(var(--accent-rgb) / 0.28)",
            }}
          >
            {p.pct !== null ? `${Math.round(p.pct)}%` : formatBRL(p.earned)}
          </p>
          <p
            className="font-medium mt-1.5"
            style={{ fontSize: "9px", color: "var(--text-muted)" }}
          >
            {p.pct !== null
              ? `${formatBRL(p.earned)} de ${formatBRL(p.meta as number)}`
              : "este mês"}
          </p>
        </div>

        <div
          className="relative grid place-items-center shrink-0"
          style={{ width: "86px", height: "86px" }}
        >
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="rgb(var(--accent-rgb) / 0.1)"
              strokeWidth="8"
            />
            {!p.isEmpty && (
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                style={{
                  filter: "drop-shadow(0 0 6px rgb(var(--accent-rgb) / 0.4))",
                  transition: "stroke-dashoffset 0.6s ease",
                }}
              />
            )}
          </svg>
          <Target
            size={22}
            className="absolute"
            style={{ color: "var(--text-2)" }}
          />
        </div>
      </div>

      {/* Barra fina — mesma fração do anel, legenda com o % exato e o
          link pro Financeiro (mantido do componente real). */}
      {!p.isEmpty && (
        <div className="mt-4">
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

      {/* Projeção viva — duas leituras, o diferencial defensável do app.
          Sem equivalente no laboratório (que só mostra "72%" fixo) —
          fica no rodapé, onde o laboratório mostra entradas/saídas (dado
          que HeroCard não recebe; ver nota de escopo no topo do arquivo). */}
      <div
        className="mt-4 pt-3"
        style={{ borderTop: "1px solid var(--divider, var(--border-color))" }}
      >
        <p
          className="font-semibold leading-snug"
          style={{ fontSize: "13px", color: "var(--text)" }}
        >
          {primary}
        </p>
        {secondary && (
          <p
            className="font-medium mt-1 leading-snug"
            style={{ fontSize: "11px", color: "var(--text-2)" }}
          >
            {secondary}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
