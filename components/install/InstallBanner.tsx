"use client";

import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { InstallSheet } from "@/components/install/InstallSheet";
import { isStandalone } from "@/lib/platform";

const STORAGE_KEY = "jobapp-install-banner-dismissed";

/**
 * Convite dispensável pra instalar o app, mostrado na Início — não no
 * onboarding (que já tem a oferta de PIN no fim; empilhar mais uma coisa
 * ali atrapalha o "mínimo de passos até o aha"). Some de vez ao ser
 * dispensado; nunca volta a incomodar.
 *
 * Compacto de propósito: uma linha só, e o X fica no canto superior do
 * cartão (não no canto inferior direito, onde o FAB flutua por cima).
 */
export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      <div className="relative">
        <GlassCard as="div" radius="lg" className="p-1 pr-7">
          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-2.5 w-full py-2 px-2.5 text-left"
          >
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{
                width: 28,
                height: 28,
                background: "rgb(var(--accent-rgb) / 0.12)",
              }}
            >
              <Smartphone size={14} style={{ color: "var(--accent)" }} />
            </div>
            <p
              className="text-xs font-semibold flex-1 min-w-0 truncate"
              style={{ color: "var(--text)" }}
            >
              Instale o app — abre mais rápido
            </p>
          </button>
        </GlassCard>
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="absolute active:opacity-70"
          style={{ top: 6, right: 6, padding: 4 }}
        >
          <X size={12} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      <InstallSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
