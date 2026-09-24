"use client";

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
  BOTTOM_NAV_MIN_TOUCH_TARGET,
  getBottomNavCompactStyle,
} from "@/lib/bottomNavCompactStyle";

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

interface Props {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

/**
 * Pílula flutuante, ícone-só — aba ativa ganha um círculo cheio na cor de
 * destaque (mesma leitura do Início do Instagram). Sem rótulo embaixo: a
 * troca de "sempre visível" por "aprende rápido com uso" foi uma escolha
 * consciente, não descuido.
 */
export function BottomNav({ activeTab, onChange }: Props) {
  // Compacta ao rolar pra baixo, expande ao rolar pra cima — reproduz o
  // efeito aprovado no laboratório visual (jobapp-visual-launch,
  // /dev-preview/launch): a pílula ENCOLHE (bordas avançam, padding cai,
  // botão ativo estreita) com só um leve acomodar vertical de 4px — não
  // é um slide pra fora de tela. Botão inativo e altura ficam sempre no
  // touch target mínimo de 44px (fb6b6c9); só o botão ativo (48/56px,
  // ambos acima do mínimo) e as bordas do container acompanham o compact.
  const compact = useScrollCompact(activeTab);
  const navStyle = getBottomNavCompactStyle(compact);

  return (
    <nav
      className="fixed z-50 flex items-center justify-between"
      style={{
        left: `${navStyle.edgeInset}px`,
        right: `${navStyle.edgeInset}px`,
        bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
        padding: `${navStyle.padding}px`,
        borderRadius: "999px",
        background: `rgb(var(--bg-rgb) / ${navStyle.backgroundOpacity})`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgb(var(--accent-rgb) / 0.14)",
        boxShadow: navStyle.shadow,
        transform: `translateY(${navStyle.translateY}px)`,
        transitionProperty:
          "left, right, padding, background-color, box-shadow, transform",
        transitionDuration: "220ms",
        transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-label={label}
            className="flex items-center justify-center transition-all duration-200"
            style={{
              height: `${BOTTOM_NAV_MIN_TOUCH_TARGET}px`,
              width: active
                ? `${navStyle.activeWidth}px`
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
    </nav>
  );
}
