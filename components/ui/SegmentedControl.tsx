"use client";

import type { ReactNode } from "react";

/**
 * Controle segmentado único (pílula ativa deslizante em espírito).
 * Substitui as 5+ cópias inline (abas do Financeiro, seletor de período,
 * período do Jobs, gráficos do Ajustes…), cada uma com trilho e cor de
 * texto ativo divergentes. Uma implementação, dois tamanhos.
 */

interface Option<T extends string> {
  id: T;
  label: ReactNode;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (id: T) => void;
  /** md = abas de tela (largura cheia); sm = seletor compacto. */
  size?: "sm" | "md";
  /** Distribui os itens em largura igual (padrão true no md). */
  fullWidth?: boolean;
  className?: string;
  /**
   * Alvo de toque mínimo de 44×44px por segmento (#174), opt-in -- mesmo
   * padrão de `minTouchTarget` do FilterChips e `largeCloseTarget` do
   * BottomSheet. Desligado (padrão), o controle fica exatamente como era.
   * Ligado, o <button> passa a medir 44×44 no mínimo, mas a pílula visível
   * (fundo, raio, texto) mora num <span> interno com a altura de sempre, e
   * uma margem vertical negativa devolve a diferença ao layout: o trilho não
   * cresce, só a área que aceita o toque.
   */
  minTouchTarget?: boolean;
}

/** Altura visual de cada segmento (padding + linha), em px. */
const ALTURA_VISUAL = { md: 32, sm: 24.5 } as const;
const ALVO_MINIMO = 44;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth,
  className = "",
  minTouchTarget = false,
}: Props<T>) {
  const isMd = size === "md";
  const stretch = fullWidth ?? isMd;

  return (
    <div
      className={`flex ${isMd ? "gap-1 p-1 rounded-2xl" : "gap-1 p-0.5 rounded-xl"} ${className}`}
      style={{ background: isMd ? "var(--surface)" : "var(--surface-2)" }}
    >
      {options.map(({ id, label }) => {
        const active = value === id;
        const forma = isMd
          ? "py-2 rounded-xl text-xs"
          : "px-2.5 py-1 rounded-lg text-[11px]";
        // Fundação Visual (#142): sem glow no estado ativo -- o
        // `.segmented .segmentActive` do protótipo é só
        // fundo+peso, nenhuma sombra (ver IOS_VISUAL_SYSTEM.md).
        const cores = {
          background: active ? "var(--accent)" : "transparent",
          color: active ? "#fff" : "var(--text-muted)",
        };

        if (!minTouchTarget) {
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`${stretch ? "flex-1" : ""} font-bold transition-all ${forma}`}
              style={cores}
            >
              {label}
            </button>
          );
        }

        // #174: o botão é o alvo de 44×44; a pílula visível é o <span>.
        const sobra = (ALVO_MINIMO - ALTURA_VISUAL[size]) / 2;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`${stretch ? "flex-1" : ""} flex items-center justify-center font-bold`}
            style={{
              minHeight: `${ALVO_MINIMO}px`,
              minWidth: `${ALVO_MINIMO}px`,
              marginBlock: `-${sobra}px`,
            }}
          >
            <span
              data-pilula
              className={`w-full transition-all ${forma}`}
              style={cores}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
