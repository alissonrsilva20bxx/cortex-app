"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  IconeAgenda,
  IconeCofre,
  IconeFinanceiro,
  IconeInicio,
  IconeRede,
  type IconeNavProps,
} from "@/components/navIcones";
import type { TabId } from "@/lib/types";
import { useScrollCompact } from "@/lib/useScrollCompact";
import {
  BOTTOM_NAV_ACTIVE_WIDTH,
  BOTTOM_NAV_DURATION_MS,
  BOTTOM_NAV_EASE,
  BOTTOM_NAV_EDGE,
  BOTTOM_NAV_EXPANDED,
  BOTTOM_NAV_ITEM_WIDTH,
  BOTTOM_NAV_MIN_TOUCH_TARGET,
  BOTTOM_NAV_OFFSET,
  BOTTOM_NAV_FAB_SIZE,
  BOTTOM_NAV_GAP,
  BOTTOM_NAV_PILL_WIDTH,
  getBottomNavCompactStyle,
} from "@/lib/bottomNavCompactStyle";
import { tabTemFab } from "@/components/FAB";

// Redesign iOS quase nativo (wayfinder #122, ticket #124): exatamente 5
// destinos — Ajustes saiu da barra e passou a abrir pelo avatar da Início
// (GreetingHeader) / voltar pelo próprio Ajustes. "ajustes" continua um
// TabId válido (lib/types.ts) e a TabPanel continua funcionando igual —
// só parou de ganhar um botão próprio aqui. Ícones com o traço do mockup
// aprovado (components/navIcones.tsx).
const TABS: {
  id: TabId;
  label: string;
  Icon: (p: IconeNavProps) => ReactNode;
}[] = [
  { id: "home", label: "Início", Icon: IconeInicio },
  { id: "jobs", label: "Agenda", Icon: IconeAgenda },
  { id: "financeiro", label: "Financeiro", Icon: IconeFinanceiro },
  { id: "cofre", label: "Cofre", Icon: IconeCofre },
  { id: "rede", label: "Rede", Icon: IconeRede },
];

interface Props {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  /** Mantém a pílula aberta (FAB aberto, tour em andamento) — o tour aponta
   * pros botões de cada aba, que somem com a pílula recolhida. */
  holdOpen?: boolean;
  /** Desenha o "+" ao lado da pílula, recebendo o mesmo estado compacto
   * pra encolher junto. Sem ele (ex.: /dev-preview/rede), a pílula ocupa
   * a linha inteira. */
  renderFab?: (compact: boolean) => ReactNode;
  /** A Jornada está aberta: a pílula segue a largura do protótipo da
   * Jornada (a linha menos o "+"), não a fixa do mockup das 5 telas. */
  pilulaDaJornada?: boolean;
}

/**
 * Pílula 2 "Recolhe pra aba atual" (escolhida no /visualize em
 * 01/10/2026): pílula flutuante ícone-só com o "+" ao lado. Rolando pra
 * baixo, a pílula recolhe numa bolinha só com o ícone da aba atual e o
 * "+" diminui junto; rolando pra cima (ou tocando na bolinha) ela abre de
 * novo. Sem rótulo embaixo: a troca de "sempre visível" por "aprende
 * rápido com uso" foi uma escolha consciente, não descuido.
 */
export function BottomNav({
  activeTab,
  onChange,
  holdOpen,
  renderFab,
  pilulaDaJornada,
}: Props) {
  const scrollCompact = useScrollCompact(activeTab);

  // Tocar na bolinha abre a pílula sem mexer na rolagem. Ela fica aberta
  // até a próxima rolagem pra baixo de verdade (> 24px) — aí recolhe de
  // novo, igual ao Safari/Instagram. Rolar pra cima zera tudo (o próprio
  // scrollCompact já abre).
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    if (!scrollCompact) setPeek(false);
  }, [scrollCompact]);
  useEffect(() => {
    if (!peek) return;
    const start = window.scrollY;
    function onScroll() {
      if (window.scrollY - start > 24) setPeek(false);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [peek]);

  const compact = scrollCompact && !peek && !holdOpen;
  const navStyle = getBottomNavCompactStyle(compact);
  const hasFab = Boolean(renderFab) && tabTemFab(activeTab);

  // Largura da pílula aberta: a do mockup (288px). Sem o "+" (ex.:
  // /dev-preview/rede), a pílula ocupa a linha inteira.
  const openWidth = !hasFab
    ? `calc(100vw - ${BOTTOM_NAV_EDGE * 2}px)`
    : pilulaDaJornada
      ? `calc(100vw - ${BOTTOM_NAV_EDGE * 2 + BOTTOM_NAV_FAB_SIZE + BOTTOM_NAV_GAP}px)`
      : `${BOTTOM_NAV_PILL_WIDTH}px`;
  const ActiveIcon = (TABS.find((t) => t.id === activeTab) ?? TABS[0]).Icon;
  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? "Início";
  const motion = `${BOTTOM_NAV_DURATION_MS}ms ${BOTTOM_NAV_EASE}`;

  return (
    <>
      {renderFab?.(compact)}
      <nav
        className="fixed z-50 overflow-hidden"
        data-compact={compact || undefined}
        style={{
          left: `${BOTTOM_NAV_EDGE}px`,
          bottom: `calc(${BOTTOM_NAV_OFFSET - navStyle.translateY}px + env(safe-area-inset-bottom, 0px))`,
          width: navStyle.collapsed ? `${navStyle.pillHeight}px` : openWidth,
          height: `${navStyle.pillHeight}px`,
          borderRadius: "999px",
          background: "var(--glass)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
          border: "1px solid var(--glass-border)",
          boxShadow: navStyle.shadow,
          transition: `width ${motion}, height ${motion}, bottom ${motion}, background-color 220ms ease, box-shadow 220ms ease`,
        }}
      >
        {/* As 5 abas — largura fixa (a da pílula aberta), então só somem
            por opacidade enquanto a pílula estreita por cima; nada se
            espreme no caminho. */}
        <div
          className="absolute left-0 top-0 grid items-center justify-items-center"
          aria-hidden={compact || undefined}
          style={{
            width: openWidth,
            // Como o mockup: a grade tem a altura cheia da pílula (60),
            // medida de dentro da borda.
            height: `${BOTTOM_NAV_EXPANDED.pillHeight}px`,
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            opacity: compact ? 0 : 1,
            pointerEvents: compact ? "none" : "auto",
            transition: `opacity ${compact ? 180 : 260}ms ease ${compact ? 0 : 120}ms`,
          }}
        >
          {TABS.map(({ id, label, Icon }) => {
            const active = id === activeTab;
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                aria-label={label}
                data-tour={`nav-${id}`}
                tabIndex={compact ? -1 : undefined}
                className="flex items-center justify-center transition-all duration-200 active:scale-90"
                style={{
                  height: `${BOTTOM_NAV_MIN_TOUCH_TARGET}px`,
                  width: active
                    ? `${BOTTOM_NAV_ACTIVE_WIDTH}px`
                    : `${BOTTOM_NAV_ITEM_WIDTH}px`,
                  borderRadius: "999px",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text-muted)",
                  // Mockup: a aba ativa não tem brilho em volta.
                }}
              >
                <Icon size={22} strokeWidth={active ? 2.3 : 2} />
              </button>
            );
          })}
        </div>

        {/* Bolinha recolhida: só o ícone da aba atual. Tocar abre a pílula. */}
        <button
          type="button"
          onClick={() => setPeek(true)}
          aria-label={`Mostrar abas (aba atual: ${activeLabel})`}
          aria-hidden={!compact || undefined}
          tabIndex={compact ? undefined : -1}
          className="absolute left-0 top-0 flex items-center justify-center rounded-full active:scale-90"
          style={{
            // Mockup (`.mini`): 50×50 medido de dentro da borda.
            width: `${navStyle.pillHeight}px`,
            height: `${navStyle.pillHeight}px`,
            color: "var(--accent-deep)",
            opacity: compact ? 1 : 0,
            pointerEvents: compact ? "auto" : "none",
            transition: `opacity ${compact ? 220 : 120}ms ease ${compact ? 180 : 0}ms, transform 150ms ease`,
          }}
        >
          <ActiveIcon size={22} strokeWidth={2.3} />
        </button>
      </nav>
    </>
  );
}
