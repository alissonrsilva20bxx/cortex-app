"use client";

import { Bell, Calendar, Users, Smartphone } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { isIOS, isStandalone } from "@/lib/platform";

/**
 * Soft-ask antes do prompt nativo do navegador (§ boa prática): explica o
 * porquê antes de gastar a única chance que o navegador dá — se ela negar
 * o prompt nativo sem contexto, a maioria dos navegadores não deixa pedir
 * de novo, só reativando manualmente nas configurações do site.
 *
 * No iPhone sem o app instalado, push não funciona (limite da Apple) — em
 * vez de mostrar um botão que não vai fazer nada, redireciona pro tutorial
 * de instalação primeiro.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onNeedsInstall: () => void;
  busy?: boolean;
}

export function NotificacoesSheet({
  open,
  onClose,
  onConfirm,
  onNeedsInstall,
  busy,
}: Props) {
  const blockedByIOS = isIOS() && !isStandalone();

  if (blockedByIOS) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Antes de ativar">
        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center justify-center">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 56,
                height: 56,
                background: "rgb(var(--accent-rgb) / 0.12)",
              }}
            >
              <Smartphone size={24} style={{ color: "var(--accent)" }} />
            </div>
          </div>
          <p
            className="text-sm leading-relaxed text-center"
            style={{ color: "var(--text-muted)" }}
          >
            No iPhone, notificações só funcionam depois que o app está instalado
            na Tela de Início — é uma regra da Apple, não nossa.
          </p>
          <button
            onClick={onNeedsInstall}
            className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Ver como instalar
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Ativar lembretes">
      <div className="px-5 py-5 space-y-5">
        <div className="flex items-center justify-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <Bell size={24} style={{ color: "var(--accent)" }} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Calendar
              size={16}
              className="shrink-0 mt-0.5"
              style={{ color: "var(--accent)" }}
            />
            <p className="text-sm" style={{ color: "var(--text)" }}>
              Avisamos quando um atendimento tá chegando perto
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Users
              size={16}
              className="shrink-0 mt-0.5"
              style={{ color: "var(--accent)" }}
            />
            <p className="text-sm" style={{ color: "var(--text)" }}>
              E quando uma cliente recorrente costuma voltar
            </p>
          </div>
        </div>

        <p
          className="text-xs text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Sem spam, sem alarme. Dá pra desativar quando quiser.
        </p>

        <button
          onClick={onConfirm}
          disabled={busy}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {busy ? "Ativando…" : "Ativar"}
        </button>
        <button
          onClick={onClose}
          className="w-full text-sm font-medium active:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          Agora não
        </button>
      </div>
    </BottomSheet>
  );
}
