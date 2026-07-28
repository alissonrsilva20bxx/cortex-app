"use client";

import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { RedeTab } from "@/components/rede/RedeTab";
import { mockUsuario } from "@/lib/mock";
import type { TabId } from "@/lib/types";

/**
 * Preview isolado da Rede, sem depender de login/Supabase — rota temporária
 * de dev (exempta no middleware via prefixo /dev-preview), não faz parte
 * do app real. Sem chrome de dev: tema/modo seguem os já salvos em
 * localStorage pelo resto do app (Ajustes), como qualquer outra tela.
 */
export default function DevPreviewRede() {
  const [activeTab] = useState<TabId>("rede");
  // Simula o teclado: enquanto o compositor do chat está focado, a
  // BottomNav some (um teclado real cobriria/empurraria ela).
  const [chatComposerFocused, setChatComposerFocused] = useState(false);

  return (
    <div
      className="relative flex flex-col min-h-screen"
      style={{ background: "var(--bg)" }}
    >
      <main
        className="flex-1 overflow-y-auto pb-40 px-4"
        style={{ paddingTop: "calc(24px + env(safe-area-inset-top, 0px))" }}
      >
        <RedeTab
          usuario={mockUsuario}
          onChatFocusChange={setChatComposerFocused}
        />
      </main>

      {!chatComposerFocused && (
        <BottomNav activeTab={activeTab} onChange={() => {}} />
      )}
    </div>
  );
}
