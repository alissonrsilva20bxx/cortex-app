"use client";

import { Plus, Briefcase, TrendingUp, Upload } from "lucide-react";
import type { TabId } from "@/lib/types";

interface SheetAction {
  label: string;
  description: string;
  Icon: typeof Briefcase;
}

const SHEET_ACTIONS: Partial<Record<TabId, SheetAction>> = {
  home: {
    label: "Novo atendimento",
    description: "Registrar um novo atendimento",
    Icon: Briefcase,
  },
  jobs: {
    label: "Novo atendimento",
    description: "Registrar um novo atendimento",
    Icon: Briefcase,
  },
  cofre: {
    // Copy corrigida (achado P2 do relatório de paridade do Cofre): o
    // UploadSheet real aceita imagem, PDF, Office e texto — não só foto.
    label: "Enviar arquivo",
    description: "Adicionar arquivo ao cofre",
    Icon: Upload,
  },
};

// Achado P1 (rodada de preflight 2026-09-04): a aba Financeiro tem 4
// sub-abas (visão/entradas/saídas/metas) e a ação real do FAB já mudava
// por sub-aba em `handleFabAction` (app/page.tsx) -- só o texto do sheet
// ficava fixo em "Editar Meta" sempre, então em "Visão" (e no fallback
// de qualquer sub-aba desconhecida) o rótulo dizia uma coisa e o form que
// abria era outro (Nova Despesa). Espelha exatamente os mesmos 4 ramos
// de `handleFabAction`, mesmo `else` final incluído.
const FINANCEIRO_SHEET_ACTIONS: Record<string, SheetAction> = {
  entradas: {
    label: "Nova Entrada",
    description: "Registrar uma entrada financeira",
    Icon: TrendingUp,
  },
  saidas: {
    label: "Nova Despesa",
    description: "Registrar uma despesa",
    Icon: TrendingUp,
  },
  metas: {
    label: "Editar Meta",
    description: "Ajustar valor alvo do período",
    Icon: TrendingUp,
  },
};

interface Props {
  activeTab: TabId;
  /** Sub-aba ativa do Financeiro ("visao" | "entradas" | "saidas" | "metas")
   * -- só usada quando activeTab === "financeiro", pra manter o rótulo do
   * sheet igual à ação que `onAction` de fato dispara. */
  financeiroSubTab?: string;
  open: boolean;
  onToggle: () => void;
  onAction?: () => void;
}

export function FAB({
  activeTab,
  financeiroSubTab,
  open,
  onToggle,
  onAction,
}: Props) {
  const action =
    activeTab === "financeiro"
      ? (financeiroSubTab && FINANCEIRO_SHEET_ACTIONS[financeiroSubTab]) ||
        FINANCEIRO_SHEET_ACTIONS.saidas
      : SHEET_ACTIONS[activeTab];
  if (!action) return null;

  const { label, description, Icon } = action;

  function handleActionClick() {
    onToggle();
    onAction?.();
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            background: "rgb(var(--bg-rgb) / 0.45)",
          }}
          onClick={onToggle}
        />
      )}

      {/* Bottom sheet */}
      <div
        className="fixed left-0 right-0 z-50 rounded-t-3xl px-5 pt-3 pb-8 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: "calc(82px + env(safe-area-inset-bottom, 0px))",
          transform: open ? "translateY(0)" : "translateY(calc(100% + 100px))",
          background: "var(--surface-2)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid var(--border-color)",
          borderBottom: "none",
        }}
      >
        {/* Drag handle */}
        <div
          className="w-9 h-1 rounded-full mx-auto mb-5"
          style={{ background: "var(--border-color)" }}
        />

        <p
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Criar novo
        </p>

        <button
          className="flex items-center gap-3 w-full px-4 py-4 rounded-2xl transition-opacity active:opacity-70"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
          }}
          onClick={handleActionClick}
        >
          <div
            className="p-2.5 rounded-xl shrink-0"
            style={{ background: "rgb(var(--accent-rgb) / 0.12)" }}
          >
            <Icon size={20} style={{ color: "var(--accent)" }} />
          </div>
          <div className="text-left">
            <p
              className="font-semibold text-sm"
              style={{ color: "var(--text)" }}
            >
              {label}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {description}
            </p>
          </div>
        </button>
      </div>

      {/* FAB button */}
      <button
        onClick={onToggle}
        className="fixed z-50 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90"
        style={{
          width: "48px",
          height: "48px",
          bottom: "calc(82px + 14px + env(safe-area-inset-bottom, 0px))",
          right: "20px",
          background: "var(--accent)",
          boxShadow: "var(--glow)",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}
      >
        <Plus size={22} color="white" strokeWidth={2.5} />
      </button>
    </>
  );
}
