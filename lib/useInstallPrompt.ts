"use client";

import { useEffect, useState } from "react";

/** Evento não-padrão do Chrome/Android — sem tipo oficial no lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Captura o prompt nativo de instalação no Android/Chrome. No iOS a Apple
 * não expõe esse evento — lá a instalação é sempre manual (ver
 * InstallSheet), então este hook só entrega algo utilizável no Android.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  }

  return { canPromptInstall: !!deferredPrompt, promptInstall };
}
