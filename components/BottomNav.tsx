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
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background:
          "linear-gradient(180deg, rgba(var(--bg-rgb), 0) 0%, rgb(var(--bg-rgb) / 0.95) 40%, rgb(var(--bg-rgb) / 0.98) 100%)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        borderTop: "1px solid rgb(var(--accent-rgb) / 0.08)",
        boxShadow:
          "0 -2px 20px rgb(var(--accent-rgb) / 0.1), inset 0 1px 0 rgb(var(--accent-rgb) / 0.05)",
      }}
    >
      <div
        className="flex items-center justify-around px-2"
        style={{ height: "80px" }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-col items-center justify-center flex-1 transition-all duration-300 hover:opacity-80"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
                transform: active ? "scale(1.05)" : "scale(1)",
              }}
            >
              {/* Active indicator pill background */}
              {active && (
                <div
                  className="absolute inset-0 rounded-[20px] transition-all duration-300"
                  style={{
                    background:
                      "linear-gradient(135deg, rgb(var(--accent-rgb) / 0.15) 0%, rgb(var(--accent-rgb) / 0.08) 100%)",
                    boxShadow:
                      "0 0 24px rgb(var(--accent-rgb) / 0.3), 0 0 8px rgb(var(--accent-rgb) / 0.2), inset 0 1px 0 rgb(var(--accent-rgb) / 0.2)",
                    border: "1px solid rgb(var(--accent-rgb) / 0.2)",
                  }}
                />
              )}

              {/* Icon with glow */}
              <div
                className="relative flex items-center justify-center mb-1"
                style={{ zIndex: 10 }}
              >
                <Icon
                  size={24}
                  strokeWidth={active ? 2.2 : 1.5}
                  className="relative transition-all duration-300"
                  style={
                    active
                      ? {
                          filter:
                            "drop-shadow(0 0 8px rgb(var(--accent-rgb) / 0.8))",
                        }
                      : undefined
                  }
                />
              </div>

              {/* Label */}
              <span
                className="relative font-bold tracking-wider transition-all duration-300"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  opacity: active ? 1 : 0.7,
                  zIndex: 10,
                }}
              >
                {label}
              </span>

              {/* Active indicator dot at bottom */}
              {active && (
                <div
                  className="absolute bottom-0 rounded-full transition-all duration-300"
                  style={{
                    width: "6px",
                    height: "6px",
                    background: "var(--accent)",
                    boxShadow: "0 0 12px rgb(var(--accent-rgb) / 0.8)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
