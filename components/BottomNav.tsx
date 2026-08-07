"use client";

import {
  Home,
  CalendarDays,
  Wallet,
  ShieldCheck,
  UsersRound,
  Settings,
} from "lucide-react";
import type { TabId } from "@/lib/types";

const TABS: { id: TabId; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Início", Icon: Home },
  { id: "jobs", label: "Agenda", Icon: CalendarDays },
  { id: "financeiro", label: "Financeiro", Icon: Wallet },
  { id: "cofre", label: "Cofre", Icon: ShieldCheck },
  { id: "rede", label: "Rede", Icon: UsersRound },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
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
  return (
    <nav
      className="fixed z-50 flex items-center justify-between"
      style={{
        left: "18px",
        right: "18px",
        bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
        padding: "8px",
        borderRadius: "999px",
        background: "rgb(var(--bg-rgb) / 0.72)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgb(var(--accent-rgb) / 0.14)",
        boxShadow: "0 16px 40px rgb(0 0 0 / 0.45)",
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
              height: "44px",
              width: active ? "56px" : "44px",
              borderRadius: "999px",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#fff" : "var(--text-muted)",
              boxShadow: active ? "var(--glow-sm)" : "none",
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
          </button>
        );
      })}
    </nav>
  );
}
