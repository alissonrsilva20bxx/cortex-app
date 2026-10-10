"use client";

import type { ReactNode } from "react";
import type { TrechoComDestaque } from "@/lib/jornada/textos";
import s from "./jornada.module.css";

/** Junta classes do módulo (as do protótipo têm hífen: `s["h-eye"]`). */
export function cx(...nomes: (string | false | null | undefined)[]): string {
  return nomes.filter(Boolean).join(" ");
}

/**
 * `ring(size, sw, p, track)` do protótipo: trilho `--t-soft` e o arco em
 * `--t-acc`, começando no topo.
 */
export function Anel({
  tamanho,
  traco,
  fracao,
  trilho = "var(--t-soft)",
}: {
  tamanho: number;
  traco: number;
  fracao: number;
  trilho?: string;
}) {
  const r = (tamanho - traco) / 2;
  const c = 2 * Math.PI * r;
  const meio = tamanho / 2;
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
      <circle
        cx={meio}
        cy={meio}
        r={r}
        fill="none"
        stroke={trilho}
        strokeWidth={traco}
      />
      <circle
        cx={meio}
        cy={meio}
        r={r}
        fill="none"
        stroke="var(--t-acc)"
        strokeWidth={traco}
        strokeLinecap="round"
        strokeDasharray={c.toFixed(1)}
        strokeDashoffset={(c * (1 - fracao)).toFixed(1)}
        transform={`rotate(-90 ${meio} ${meio})`}
        style={{ transition: "stroke-dashoffset .6s" }}
      />
    </svg>
  );
}

/** A nota cinza do fim de cada seção, com o trecho em negrito do protótipo. */
export function Nota({
  texto,
  style,
}: {
  texto: TrechoComDestaque;
  style?: React.CSSProperties;
}) {
  const [antes, destaque, depois] = texto;
  return (
    <div className={s.note} style={style}>
      {antes}
      <b>{destaque}</b>
      {depois}
    </div>
  );
}

/** `<section class="cx">` com o cabeçalho `.ch` (título + chip opcional). */
export function Secao({
  titulo,
  chip,
  gap,
  children,
}: {
  titulo: string;
  chip?: ReactNode;
  gap: number;
  children: ReactNode;
}) {
  return (
    <section className={s.cx} style={{ gap: `${gap}px` }}>
      <div className={s.ch}>
        <h3>{titulo}</h3>
        {chip !== undefined && <span className={s.chip}>{chip}</span>}
      </div>
      {children}
    </section>
  );
}

/** Anel de progresso do card do Início (components/home/JornadaCard,
 * fora desta tela): `fracao` de 0 a 1. Sem mudança. */
export function JornadaAnel({
  fracao,
  tamanho,
  espessura,
  children,
}: {
  fracao: number;
  tamanho: number;
  espessura: number;
  children?: ReactNode;
}) {
  const raio = (tamanho - espessura) / 2;
  const centro = tamanho / 2;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: `${tamanho}px`, height: `${tamanho}px` }}
    >
      <svg
        aria-hidden
        width={tamanho}
        height={tamanho}
        viewBox={`0 0 ${tamanho} ${tamanho}`}
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke="var(--j-trilho)"
          strokeWidth={espessura}
        />
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke="var(--j-progresso)"
          strokeWidth={espessura}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - Math.min(1, Math.max(0, fracao))}
        />
      </svg>
      {children}
    </span>
  );
}

// ── Peças da seção "Seus 4 pilares", sem mudança: a porcentagem do
// protótipo depende de decisão do operador (PR #208). ──

/** Um card de seção: título, chip opcional à direita, conteúdo e nota. */
export function JornadaSecao({
  titulo,
  chip,
  nota,
  children,
}: {
  titulo: string;
  chip?: string;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="flex flex-col gap-[14px]"
      style={{
        padding: "16px",
        borderRadius: "var(--radius-lg)",
        background: "var(--j-card)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-extrabold" style={{ fontSize: "16px" }}>
          {titulo}
        </h2>
        {chip && <JornadaChip>{chip}</JornadaChip>}
      </div>
      {children}
      {nota && (
        <p
          className="leading-snug"
          style={{ fontSize: "12px", color: "var(--text-muted)" }}
        >
          {nota}
        </p>
      )}
    </section>
  );
}

/** Barra de progresso; `fracao` de 0 a 1. */
export function JornadaBarra({
  fracao,
  cor = "var(--j-progresso)",
  trilho = "var(--j-trilho)",
  altura = 6,
}: {
  fracao: number;
  cor?: string;
  trilho?: string;
  altura?: number;
}) {
  return (
    <div
      aria-hidden
      className="w-full overflow-hidden"
      style={{
        height: `${altura}px`,
        borderRadius: "var(--radius-pill)",
        background: trilho,
      }}
    >
      <div
        className="h-full w-full origin-left transition-transform duration-500"
        style={{
          transform: `scaleX(${Math.min(1, Math.max(0, fracao))})`,
          borderRadius: "var(--radius-pill)",
          background: cor,
        }}
      />
    </div>
  );
}

export function JornadaChip({ children }: { children: ReactNode }) {
  return (
    <span
      className="shrink-0 font-bold tabular-nums"
      style={{
        fontSize: "11px",
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        background: "var(--j-chip-bg)",
        color: "var(--j-chip-texto)",
      }}
    >
      {children}
    </span>
  );
}
