"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  CalendarDays,
  Wallet,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { TabId } from "@/lib/types";
import { useScrollCompact } from "@/lib/useScrollCompact";
import {
  BOTTOM_NAV_ACTIVE_WIDTH,
  BOTTOM_NAV_DURATION_MS,
  BOTTOM_NAV_EASE,
  BOTTOM_NAV_EDGE,
  BOTTOM_NAV_EXPANDED,
  BOTTOM_NAV_GAP,
  BOTTOM_NAV_MIN_TOUCH_TARGET,
  getBottomNavCompactStyle,
} from "@/lib/bottomNavCompactStyle";
import { tabTemFab } from "@/components/FAB";

// Redesign iOS quase nativo (wayfinder #122, ticket #124): exatamente 5
// destinos — Ajustes saiu da barra e passou a abrir pelo avatar da Início
// (GreetingHeader) / voltar pelo próprio Ajustes. "ajustes" continua um
// TabId válido (lib/types.ts) e a TabPanel continua funcionando igual —
// só parou de ganhar um botão próprio aqui.
const TABS: { id: TabId; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Início", Icon: Home },
  { id: "jobs", label: "Agenda", Icon: CalendarDays },
  { id: "financeiro", label: "Financeiro", Icon: Wallet },
  { id: "cofre", label: "Cofre", Icon: ShieldCheck },
  { id: "rede", label: "Rede", Icon: UsersRound },
];

/** Distância da linha (pílula + "+") até a borda de baixo, fora a safe area. */
const BOTTOM_OFFSET = 18;

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
}

/**
 * Pílula 2 "Recolhe pra aba atual" (escolhida no /visualize em
 * 01/10/2026): pílula flutuante ícone-só com o "+" ao lado. Rolando pra
 * baixo, a pílula recolhe numa bolinha só com o ícone da aba atual e o
 * "+" diminui junto; rolando pra cima (ou tocando na bolinha) ela abre de
 * novo. Sem rótulo embaixo: a troca de "sempre visível" por "aprende
 * rápido com uso" foi uma escolha consciente, não descuido.
 */
export function BottomNav({ activeTab, onChange, holdOpen, renderFab }: Props) {
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

  // Largura da pílula aberta: a linha toda menos as bordas e, se houver,
  // o "+" ao lado (pelo tamanho ABERTO dele — os ícones não pulam de
  // lugar enquanto o "+" encolhe).
  const reserved =
    BOTTOM_NAV_EDGE * 2 +
    (hasFab ? BOTTOM_NAV_EXPANDED.fabSize + BOTTOM_NAV_GAP : 0);
  const openWidth = `calc(100vw - ${reserved}px)`;
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
          bottom: `calc(${BOTTOM_OFFSET - navStyle.translateY}px + env(safe-area-inset-bottom, 0px))`,
          width: navStyle.collapsed ? `${navStyle.pillHeight}px` : openWidth,
          height: `${navStyle.pillHeight}px`,
          borderRadius: "999px",
          background: `rgb(var(--bg-rgb) / ${navStyle.backgroundOpacity})`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgb(var(--accent-rgb) / 0.14)",
          boxShadow: navStyle.shadow,
          transition: `width ${motion}, height ${motion}, bottom ${motion}, background-color 220ms ease, box-shadow 220ms ease`,
        }}
      >
        {/* As 5 abas — largura fixa (a da pílula aberta), então só somem
            por opacidade enquanto a pílula estreita por cima; nada se
            espreme no caminho. */}
        <div
          className="absolute left-0 top-0 flex items-center justify-between"
          aria-hidden={compact || undefined}
          style={{
            width: openWidth,
            height: `${BOTTOM_NAV_EXPANDED.pillHeight - 2}px`,
            padding: "0 7px",
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
                    : `${BOTTOM_NAV_MIN_TOUCH_TARGET}px`,
                  borderRadius: "999px",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text-muted)",
                  // Fundação Visual (#142): --glow-sm é um halo duplo (auréola +
                  // inset) que o `.navActive` do protótipo não tem -- lá é uma
                  // única sombra de elevação (0 0 18px rgba(accent,0.4)).
                  boxShadow: active
                    ? "0 0 18px rgb(var(--accent-rgb) / 0.4)"
                    : "none",
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
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
            width: `${navStyle.pillHeight - 2}px`,
            height: `${navStyle.pillHeight - 2}px`,
            color: "var(--accent)",
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
