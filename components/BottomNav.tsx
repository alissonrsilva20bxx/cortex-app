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
        background: "rgb(var(--bg-rgb) / 0.86)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderTop: "1px solid var(--divider, var(--border-color))",
        boxShadow: "0 -1px 0 rgb(var(--accent-rgb) / 0.06)",
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
            {/* Icon with active glow pill */}
            <div className="relative flex items-center justify-center">
              {active && (
                <div
                  className="absolute rounded-2xl"
                  style={{
                    inset: "-6px -12px",
                    background: "rgb(var(--accent-rgb) / 0.1)",
                    boxShadow: "0 0 12px rgb(var(--accent-rgb) / 0.12)",
                  }}
                />
              )}
              <Icon
                size={21}
                strokeWidth={active ? 2.2 : 1.6}
                className="relative"
              />
            </div>

            <span
              className="relative font-semibold tracking-wide"
              style={{ fontSize: "10px" }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
