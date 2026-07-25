"use client";

import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { RedeTab } from "@/components/rede/RedeTab";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, THEME_LABELS } from "@/lib/theme";
import { mockUsuario } from "@/lib/mock";
import type { TabId } from "@/lib/types";

/**
 * Preview isolado da Rede, sem depender de login/Supabase — rota temporária
 * de dev (exempta no middleware via prefixo /dev-preview), não faz parte
 * do app real.
 */
export default function DevPreviewRede() {
  const [activeTab] = useState<TabId>("rede");
  const { theme, setTheme, mode, setMode } = useTheme();

  return (
    <div
      className="relative flex flex-col min-h-screen"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar"
        style={{ borderBottom: "1px solid var(--border-color)" }}
      >
        <button
          onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {mode === "dark" ? "Escuro" : "Claro"}
        </button>
        {THEMES.map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: theme === t ? "var(--accent)" : "var(--surface)",
              color: theme === t ? "#fff" : "var(--text-muted)",
              border: "1px solid var(--border-color)",
            }}
          >
            {THEME_LABELS[t]}
          </button>
        ))}
      </div>

      <main
        className="flex-1 overflow-y-auto pb-40 px-4"
        style={{ paddingTop: "24px" }}
      >
        <RedeTab usuario={mockUsuario} />
      </main>

      <BottomNav activeTab={activeTab} onChange={() => {}} />
    </div>
  );
}
