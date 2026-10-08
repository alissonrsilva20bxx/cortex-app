"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, PenSquare, TrendingUp, Upload } from "lucide-react";
import { collidesWithAny, type Rect } from "@/lib/rectCollision";
import type { TabId } from "@/lib/types";
import {
  BOTTOM_NAV_DURATION_MS,
  BOTTOM_NAV_EASE,
  BOTTOM_NAV_EDGE,
  BOTTOM_NAV_OFFSET,
  getBottomNavCompactStyle,
} from "@/lib/bottomNavCompactStyle";

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
  // Pixel do mockup: a Rede tem o "+" ("Postar"). Abre o mesmo compositor
  // do "Postar" do feed (RedeTab); só aparece com a Rede liberada.
  rede: {
    label: "Postar",
    description: "Publicar no feed da Rede",
    Icon: PenSquare,
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

/**
 * Nome acessível do "+" por aba (Jornada J01) -- exatamente o do mockup
 * aprovado (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html,
 * `aria-label` do `.plus` de cada tela). É o nome do botão em si; o sheet
 * que ele abre continua com o rótulo da ação real (SHEET_ACTIONS /
 * FINANCEIRO_SHEET_ACTIONS acima), que no Financeiro muda por sub-aba.
 * Na Rede é "Postar", como o mockup (pixel do mockup).
 */
const FAB_ARIA_LABELS: Partial<Record<TabId, string>> = {
  home: "Novo",
  jobs: "Novo atendimento",
  financeiro: "Novo lançamento",
  cofre: "Enviar arquivo",
  rede: "Postar",
};

/** A aba tem "+"? (Ajustes não tem -- aí a pílula ocupa a linha toda. A
 * Rede tem, mas a página só desenha o "+" com a Rede liberada.) */
export function tabTemFab(tab: TabId): boolean {
  return tab === "financeiro" || Boolean(SHEET_ACTIONS[tab]);
}

interface Props {
  activeTab: TabId;
  /** Sub-aba ativa do Financeiro ("visao" | "entradas" | "saidas" | "metas")
   * -- só usada quando activeTab === "financeiro", pra manter o rótulo do
   * sheet igual à ação que `onAction` de fato dispara. */
  financeiroSubTab?: string;
  open: boolean;
  onToggle: () => void;
  onAction?: () => void;
  /** Estado compacto da BottomNav -- o "+" mora ao lado da pílula e
   * encolhe junto com ela (pílula 2, "Recolhe pra aba atual"). */
  compact?: boolean;
  /** Uma tela cobre a aba por inteiro (a Jornada): nada da aba de trás está
   * ao alcance, então o "+" não recua por causa do que está escondido. */
  cobertoPorTela?: boolean;
}

export function FAB({
  activeTab,
  financeiroSubTab,
  open,
  onToggle,
  onAction,
  compact = false,
  cobertoPorTela = false,
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
  // Com uma tela por cima (Jornada), os `data-fab-avoid` da aba ficam
  // escondidos atrás dela: não contam.
  const { ref: fabRef, obstructed } = useFabCollisionAvoidance(
    Boolean(action) && !open && !cobertoPorTela
  );

  if (!action) return null;

  const { label, description, Icon } = action;
  const navStyle = getBottomNavCompactStyle(compact);
  const motion = `${BOTTOM_NAV_DURATION_MS}ms ${BOTTOM_NAV_EASE}`;

  function handleActionClick() {
    onToggle();
    onAction?.();
  }

  return (
    <>
      {/* Backdrop -- Fundação Visual (#142): preto semi-opaco sem blur, como
          `.sheetBackdrop` do protótipo (ver components/ui/BottomSheet.tsx). */}
      {/* Fade de entrada/saída (antes surgia seco num frame), como o
          véu do BottomSheet. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40"
        style={{
          background: "rgba(0, 0, 0, 0.62)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
          transition: open
            ? "opacity 300ms cubic-bezier(0.32, 0.72, 0, 1), visibility 0s linear 0s"
            : "opacity 300ms cubic-bezier(0.32, 0.72, 0, 1), visibility 0s linear 300ms",
        }}
        onClick={onToggle}
      />

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
          className="press flex items-center gap-3 w-full px-4 py-4 rounded-2xl active:opacity-70"
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
        aria-label={
          open ? "Fechar" : (FAB_ARIA_LABELS[activeTab] ?? "Criar novo")
        }
        data-tour="fab"
        aria-expanded={open}
        aria-hidden={obstructed || undefined}
        tabIndex={obstructed ? -1 : undefined}
        className="fixed z-50 flex items-center justify-center rounded-full active:scale-90"
        style={{
          // Mesma linha da pílula (BottomNav), alinhado pela base: encolhe
          // e acomoda os mesmos px que ela, na mesma curva.
          width: `${navStyle.fabSize}px`,
          height: `${navStyle.fabSize}px`,
          bottom: `calc(${BOTTOM_NAV_OFFSET - navStyle.translateY}px + env(safe-area-inset-bottom, 0px))`,
          right: `${BOTTOM_NAV_EDGE}px`,
          transition: `width ${motion}, height ${motion}, bottom ${motion}, opacity 300ms ease, transform 150ms ease`,
          background: "var(--accent)",
          // Sombra do "+" do mockup aprovado (`.bar .plus`, --t-plus-sh).
          boxShadow: "0 8px 20px var(--fab-shadow)",
          opacity: obstructed ? 0.28 : 1,
          pointerEvents: obstructed ? "none" : "auto",
        }}
      >
        {/* A rotação mora no ícone, não no botão: um `transform` inline no
            botão anulava o `active:scale-90` (estilo inline vence classe) e
            o toque no FAB não dava feedback nenhum. */}
        {/* O "+" do mockup (`.plus svg`): um path só, "M12 5v14M5 12h14",
            24px, traço 2,6. O Plus do lucide são dois paths e as pontas
            saíam diferentes (ordem do operador: pixel idêntico). */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </>
  );
}
