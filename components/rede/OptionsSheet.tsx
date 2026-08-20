"use client";

import type { LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

export interface SheetOption {
  key: string;
  label: string;
  Icon: LucideIcon;
  danger?: boolean;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  title: string;
  options: SheetOption[];
  onClose: () => void;
}

/**
 * Sheet genérico de opções — usado pelo menu de publicação e compartilhar.
 * Botão fechar sempre em 44×44 (achado #56) — diferente do `BottomSheet`
 * genérico, aqui não há motivo pra manter o alvo pequeno em nenhum dos
 * três consumidores atuais (Amigas, Perfil público, Feed), então o
 * passthrough vem fixo em vez de opt-in por chamador.
 */
export function OptionsSheet({ open, title, options, onClose }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} largeCloseTarget>
      <div className="px-5 py-3 pb-6 space-y-1">
        {options.map(({ key, label, Icon, danger, onSelect }) => (
          <button
            key={key}
            onClick={() => {
              onSelect();
              onClose();
            }}
            className="flex items-center gap-3.5 w-full py-3.5 text-left transition-opacity active:opacity-70"
          >
            <Icon
              size={18}
              style={{ color: danger ? "var(--danger)" : "var(--text-muted)" }}
            />
            <span
              className="font-medium text-sm"
              style={{ color: danger ? "var(--danger)" : "var(--text)" }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
