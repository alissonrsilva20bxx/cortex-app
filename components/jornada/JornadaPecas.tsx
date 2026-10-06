"use client";

import type { ReactNode } from "react";

/**
 * Peças de layout da tela "Sua Jornada" (J12, #162), no desenho do
 * protótipo aprovado (docs/jornada/referencias/prototipo-sua-jornada.html).
 * Só forma: nenhum texto, nenhum número de Glow. Cores dos tokens `--j-*`
 * (styles/globals.css), que derivam dos tokens de tema: funcionam nos 8
 * temas, claro e escuro.
 */

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

/** Anel de progresso (card do Início); `fracao` de 0 a 1. */
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
