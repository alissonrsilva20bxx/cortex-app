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
