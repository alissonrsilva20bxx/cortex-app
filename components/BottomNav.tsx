"use client";

import { Home, Briefcase, Wallet, ShieldCheck, Settings } from "lucide-react";
import type { TabId } from "@/lib/types";

const TABS: { id: TabId; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "jobs", label: "Jobs", Icon: Briefcase },
  { id: "financeiro", label: "Financeiro", Icon: Wallet },
  { id: "cofre", label: "Cofre", Icon: ShieldCheck },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
];

interface Props {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

export function BottomNav({ activeTab, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1"
      style={{
        height: "68px",
        background: "rgb(var(--bg-rgb) / 0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid var(--border-color)",
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex flex-col items-center gap-1 flex-1 py-2 transition-all duration-200"
            style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
          >
            <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
            <span className="text-[10px] font-medium tracking-wide">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
