"use client";

import { ChevronRight, Plane } from "lucide-react";
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
    // Fundação Visual (#142): sem `style` — o card usa o material neutro
    // compartilhado de `.glass-card` (globals.css), não uma superfície
    // duplicada por arquivo. Ver nota equivalente em NextJobCard.tsx.
    <GlassCard radius="lg" className="p-5">
      {/* Cabeçalho: título + subtítulo à esquerda, anel de progresso à
          direita — mesma composição do protótipo aprovado (`.heroTop`,
          /dev-preview/ios, IosPrototypeApp.tsx:1119-1127). "Sua projeção"
          é o título real do card (antes desaparecido — achado da revisão
          visual #131); o anel usa a MESMA fração real que a barra fina
          abaixo (p.pct ou p.barFraction), não é decorativo como no
          protótipo estático. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* `.card-title` (globals.css) — mesma regra compartilhada que
              NextJobCard/ObjetivosCard usam pro próprio <h2>, espelhando
              o `.card h2` único do protótipo (achado #131: os 3 arquivos
              duplicavam 3 versões ligeiramente diferentes de 13px/600). */}
          <h2 className="card-title">Sua projeção</h2>
          {/* Subtítulo — mesmo papel do "Você está construindo no seu
              ritmo" fixo do protótipo, mas com o mês real (dado que o
              protótipo não tem, congelado em "0%"). */}
          <p
            className="font-medium mt-0.5"
            style={{ fontSize: "13px", color: "var(--text-2)" }}
          >
            {p.isEmpty
              ? "Você está construindo no seu ritmo"
              : `${p.monthLabel} · no seu ritmo`}
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
          {/* Avião, não o alvo genérico que estava aqui — é a identidade
              liberdade/viagem do app (protótipo, `.flightRing`), achado da
              revisão visual #131: um ícone genérico de meta apaga essa
              identidade. Tamanho/cor medidos do protótipo (31px,
              --p-accent-soft) e escalados pro nosso anel de 86px (vs os
              76px dele) — var(--accent-soft) é o mesmo tom (pink-neon:
              #ff80ab ≈ --p-accent-soft #ff78aa). */}
          <Plane
            size={28}
            className="absolute"
            style={{ color: "var(--accent-soft)" }}
          />
        </div>
      </div>

      {/* Valor — protagonista da tela (Início: "resumo financeiro como
          protagonista"). 48px/700/-0.065em/--accent-soft, igual ao
          `.bigMetric` do protótipo aprovado (achado da revisão visual
          #131: tinha caído pra 30px/600/--accent — o protótipo usa a
          variante SUAVE do acento aqui, reservando o acento cheio pro CTA
          sólido, pra não competir pela atenção). Hierarquia: quando há
          meta, o número gigante é o PERCENTUAL (não o valor em reais) —
          o real vem como legenda menor embaixo, igual ao "R$ 4.860 de
          R$ 6.750,00" do laboratório. Sem meta não há percentual real pra
          mostrar (p.pct é null), então o valor em reais volta a ser o
          protagonista — nunca um % inventado. */}
      <p
        className="font-bold tabular-nums leading-none mt-3"
        style={{
          fontSize: "48px",
          letterSpacing: "-0.065em",
          color: "var(--accent-soft)",
          textShadow: "0 0 20px rgb(var(--accent-rgb) / 0.28)",
        }}
      >
        {p.pct !== null ? `${Math.round(p.pct)}%` : formatBRL(p.earned)}
      </p>
      <p
        className="font-medium mt-1"
        style={{ fontSize: "13px", color: "var(--text-muted)" }}
      >
        {p.pct !== null
          ? `${formatBRL(p.earned)} de ${formatBRL(p.meta as number)}`
          : "este mês"}
      </p>

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

      {/* CTA aprovado do protótipo (/dev-preview/ios, "Ver minha evolução")
          — issue #134. Antes desta ticket o card inteiro era o <button>
          (GlassCard com onClick), sem afordância visível; a composição
          aprovada usa um botão explícito de largura total, então o
          GlassCard virou <div> (sem onClick) e este é o único elemento
          clicável do card — mesmo padrão de afordância explícita já usado
          pelos outros cards da Início (cabeçalho de NextJobCard, "Ver
          todos" de ObjetivosCard), evitando <button> aninhado dentro do
          <button> que o GlassCard clicável produzia. Cor sempre temática
          (`var(--accent)`, convenção já usada em JobForm/OnboardingFlow) —
          nunca o rosa fixo (`#ff2d78`) do CSS module do protótipo
          (decisão da Fase 1, #124). Mesmo destino de navegação que o card
          inteiro tinha antes (onGoToFinanceiro), sem função nova. */}
      <button
        onClick={onGoToFinanceiro}
        className="mt-4 w-full py-3 rounded-2xl font-semibold flex items-center justify-center gap-1 transition-opacity active:opacity-80"
        style={{
          fontSize: "14px",
          background: "var(--accent)",
          color: "white",
        }}
      >
        Ver minha evolução
        <ChevronRight size={18} />
      </button>
    </GlassCard>
  );
}
