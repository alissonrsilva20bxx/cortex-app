"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Briefcase, TrendingUp, Upload } from "lucide-react";
import { collidesWithAny, type Rect } from "@/lib/rectCollision";
import type { TabId } from "@/lib/types";

/**
 * Evita que o FAB (fixo, z-50) obstrua uma ação real — achado da revisão
 * visual #131: em 390px, o FAB cobria "Ver todos" de Objetivos já na
 * posição de rolagem inicial (sem o usuário precisar rolar até lá). Como
 * o FAB é `position: fixed` e o conteúdo da aba tem altura variável (nº
 * de objetivos, atendimento visível ou não, meta definida ou não), não
 * dá pra "consertar" isso com um valor de espaçamento fixo — qualquer
 * card real pode, em algum estado de dados, acabar posicionado atrás do
 * FAB. A correção é o FAB verificar sua PRÓPRIA colisão contra os
 * elementos acionáveis marcados com `data-fab-avoid` (mesmo padrão em
 * qualquer aba, não só Início) e recuar (opacidade baixa +
 * `pointer-events: none`, sem desmontar) enquanto colide — a ação por
 * baixo fica sempre alcançável, e o FAB volta assim que o usuário rola
 * o suficiente pra desobstruir. Preserva a criação de atendimento: o FAB
 * nunca é removido, só cede passagem temporariamente.
 */
function useFabCollisionAvoidance(active: boolean) {
  const ref = useRef<HTMLButtonElement>(null);
  const [obstructed, setObstructed] = useState(false);

  useEffect(() => {
    if (!active) {
      setObstructed(false);
      return;
    }

    function check() {
      const el = ref.current;
      if (!el) return;
      const fabRect: Rect = el.getBoundingClientRect();
      const avoidRects = Array.from(
        document.querySelectorAll<HTMLElement>("[data-fab-avoid]")
      ).map((n) => n.getBoundingClientRect());
      setObstructed(collidesWithAny(fabRect, avoidRects));
    }

    check();

    let raf = 0;
    function onScrollOrResize() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    }
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    // Conteúdo pode mudar de altura sem scroll/resize nenhum (marcar
    // objetivo como concluído reordena a lista, abrir/fechar o
    // NextJobCard expande, trocar homeCards em Ajustes some com um
    // card) -- observa o container rolável pra pegar essas mudanças.
    const scrollRoot = document.querySelector("main") ?? document.body;
    const resizeObserver = new ResizeObserver(onScrollOrResize);
    resizeObserver.observe(scrollRoot);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      resizeObserver.disconnect();
    };
  }, [active]);

  return { ref, obstructed };
}

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

  // Hook chamado incondicionalmente (Regras dos Hooks) — o `return null`
  // por falta de `action` vem DEPOIS. Só verifica colisão com o sheet
  // fechado -- com ele aberto o botão vira o "X" de fechar sobre o
  // próprio backdrop, sem risco de cobrir outra ação (a tela toda já
  // está bloqueada pelo backdrop).
  const { ref: fabRef, obstructed } = useFabCollisionAvoidance(
    Boolean(action) && !open
  );

  if (!action) return null;

  const { label, description, Icon } = action;

  function handleActionClick() {
    onToggle();
    onAction?.();
  }

  return (
    <>
      {/* Backdrop -- Fundação Visual (#142): preto semi-opaco sem blur, como
          `.sheetBackdrop` do protótipo (ver components/ui/BottomSheet.tsx). */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0, 0, 0, 0.62)" }}
          onClick={onToggle}
        />
      )}

      {/* Bottom sheet -- material igual ao de components/ui/BottomSheet.tsx:
          gradiente opaco sobre --bg do tema, sem blur; raio do topo usa
          --radius-sheet (26px), não o rounded-t-3xl (24px fixo do Tailwind). */}
      <div
        className="fixed left-0 right-0 z-50 px-5 pt-3 pb-8 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: "calc(82px + env(safe-area-inset-bottom, 0px))",
          transform: open ? "translateY(0)" : "translateY(calc(100% + 100px))",
          background: `linear-gradient(180deg, rgb(var(--bg-rgb) / 0.97), rgb(var(--bg-rgb) / 0.995) 70%)`,
          border: "1px solid var(--card-border)",
          borderBottom: "none",
          borderTopLeftRadius: "var(--radius-sheet)",
          borderTopRightRadius: "var(--radius-sheet)",
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

      {/* FAB button — recua (opacidade baixa + pointer-events: none) em vez
          de desmontar quando `obstructed` (achado #131): a ação de criar
          continua existindo, só cede passagem enquanto colide com algo
          marcado `data-fab-avoid`; volta ao normal assim que o usuário rola
          o suficiente pra desobstruir. */}
      <button
        ref={fabRef}
        onClick={onToggle}
        aria-hidden={obstructed || undefined}
        tabIndex={obstructed ? -1 : undefined}
        className="fixed z-50 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90"
        style={{
          width: "48px",
          height: "48px",
          bottom: "calc(82px + 14px + env(safe-area-inset-bottom, 0px))",
          right: "20px",
          background: "var(--accent)",
          // Fundação Visual (#142): elevação direcional como `.addButton` do
          // protótipo, não o halo difuso de --glow.
          boxShadow: "0 10px 26px rgb(var(--accent-rgb) / 0.25)",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
          opacity: obstructed ? 0.28 : 1,
          pointerEvents: obstructed ? "none" : "auto",
        }}
      >
        <Plus size={22} color="white" strokeWidth={2.5} />
      </button>
    </>
  );
}
