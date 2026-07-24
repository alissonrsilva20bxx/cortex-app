"use client";

import { Share, SquarePlus, ChevronDown, Download } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { isIOS } from "@/lib/platform";
import { useInstallPrompt } from "@/lib/useInstallPrompt";

/**
 * Tutorial de instalação (tela de início). No Android, o navegador expõe
 * um evento que a gente escuta e vira um botão de 1 toque. A Apple não dá
 * esse gancho — no iPhone é sempre manual, então em vez de só descrever em
 * texto, mostramos um mini-fluxo ilustrado (ícone de compartilhar → item
 * "Adicionar à Tela de Início"), no mesmo idioma visual do app — não uma
 * cópia da interface real da Apple, só uma pista visual de onde tocar.
 */

interface Props {
  open: boolean;
  onClose: () => void;
}

function StepBadge({ n }: { n: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold shrink-0"
      style={{
        width: 22,
        height: 22,
        fontSize: 11,
        background: "var(--accent)",
        color: "white",
      }}
    >
      {n}
    </div>
  );
}

function ToolbarMock() {
  return (
    <div
      className="flex items-center justify-center gap-6 py-3.5 rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div
        className="rounded-full"
        style={{ width: 14, height: 14, background: "var(--border-color)" }}
      />
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 38,
          height: 38,
          background: "rgb(var(--accent-rgb) / 0.18)",
          border: "2px solid var(--accent)",
          boxShadow: "var(--glow-sm)",
        }}
      >
        <Share size={17} style={{ color: "var(--accent)" }} />
      </div>
      <div
        className="rounded-full"
        style={{ width: 14, height: 14, background: "var(--border-color)" }}
      />
    </div>
  );
}

function MenuRowMock() {
  return (
    <div
      className="flex items-center gap-3 py-3 px-3.5 rounded-2xl"
      style={{
        background: "rgb(var(--accent-rgb) / 0.1)",
        border: "2px solid var(--accent)",
        boxShadow: "var(--glow-sm)",
      }}
    >
      <div
        className="flex items-center justify-center rounded-lg shrink-0"
        style={{ width: 26, height: 26, background: "var(--accent)" }}
      >
        <SquarePlus size={15} color="white" />
      </div>
      <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
        Adicionar à Tela de Início
      </p>
    </div>
  );
}

export function InstallSheet({ open, onClose }: Props) {
  const { canPromptInstall, promptInstall } = useInstallPrompt();
  const ios = isIOS();

  async function handleInstallClick() {
    const accepted = await promptInstall();
    if (accepted) onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Instalar o app">
      <div className="px-5 py-5 space-y-5">
        <p
          className="text-xs text-center leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Abre mais rápido, funciona offline
          {ios && ", e é o único jeito de receber lembretes no iPhone"}.
        </p>

        {ios ? (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <StepBadge n={1} />
              <div className="flex-1 space-y-2">
                <ToolbarMock />
                <p
                  className="text-xs leading-snug"
                  style={{ color: "var(--text)" }}
                >
                  Toque no ícone de <strong>compartilhar</strong>, na barra do
                  Safari
                </p>
              </div>
            </div>

            <div className="flex justify-center" style={{ marginLeft: 10 }}>
              <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
            </div>

            <div className="flex items-start gap-3">
              <StepBadge n={2} />
              <div className="flex-1 space-y-2">
                <MenuRowMock />
                <p
                  className="text-xs leading-snug"
                  style={{ color: "var(--text)" }}
                >
                  Escolha essa opção na lista que abrir
                </p>
              </div>
            </div>
          </div>
        ) : canPromptInstall ? (
          <button
            onClick={handleInstallClick}
            className="w-full py-3.5 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-opacity active:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <Download size={18} />
            Instalar agora
          </button>
        ) : (
          <p
            className="text-sm text-center"
            style={{ color: "var(--text-muted)" }}
          >
            Abra o menu do navegador e escolha{" "}
            <strong>&quot;Instalar app&quot;</strong> ou{" "}
            <strong>&quot;Adicionar à tela inicial&quot;</strong>.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
