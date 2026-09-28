"use client";

import { Check, ChevronRight, ListChecks } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Objetivo } from "@/lib/types";

interface Props {
  objetivos: Objetivo[];
  onToggle: (id: string, done: boolean) => void;
  onGoToMetas: () => void;
}

const OBJ_CAT_EMOJIS: Record<string, string> = {
  afazeres: "✅",
  vida: "🌟",
  saude: "💪",
  financeiro: "💰",
  outros: "📌",
};

/**
 * Nota de contrato (não de material): o laboratório mostra "Objetivos"
 * como barras de progresso percentuais (metas financeiras) — o dado real
 * de `Objetivo` é binário (`concluido`), sem campo de percentual. Manter
 * o contrato atual (checklist binário) e não inventar uma % que não
 * existe é a decisão registrada no ticket T2 (#29) e no princípio 3 do
 * plano de integração visual: entregar com o contrato atual, registrar a
 * UI percentual como pendência de produto.
 *
 * Material: SEM `style` de superfície própria (achado #131) — o card usa
 * o material neutro compartilhado de `.glass-card` (globals.css), como
 * HeroCard/NextJobCard. A versão antiga duplicava um objeto de superfície
 * próprio com `border: var(--border-color)`, que produzia um contorno temático
 * (rosa em pink-neon, etc.) em vez da borda neutra `--card-border` que
 * `.glass-card` já aplica.
 */
export function ObjetivosCard({ objetivos, onToggle, onGoToMetas }: Props) {
  if (objetivos.length === 0) {
    return (
      <GlassCard className="p-5" radius="lg">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <ListChecks size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            {/* `.card-title` (globals.css, achado #131) — mesma regra
                compartilhada de HeroCard/NextJobCard. */}
            <h2 className="card-title">Objetivos</h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Afazeres e metas de vida, num só lugar
            </p>
          </div>
        </div>
        {/* minHeight: 44px — alvo de toque mínimo (spec, "Alvos de toque
            44×44px"); py-2.5 + text-xs sozinho renderiza ~36px. Mesmo
            padrão já usado no botão "Ver todos" deste arquivo. */}
        <button
          onClick={onGoToMetas}
          // Achado #131: marca pro FAB recuar se colidir (ver FAB.tsx).
          data-fab-avoid
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
          style={{
            background: "rgb(var(--accent-rgb) / 0.08)",
            color: "var(--accent)",
            border: "1px solid rgb(var(--accent-rgb) / 0.2)",
            minHeight: "44px",
          }}
        >
          Adicionar objetivo
          <ChevronRight size={13} />
        </button>
      </GlassCard>
    );
  }

  const pendentes = objetivos.filter((o) => !o.concluido);
  const todos = objetivos.length;
  const concluidos = todos - pendentes.length;
  const allDone = concluidos === todos;

  const visible = [...pendentes, ...objetivos.filter((o) => o.concluido)].slice(
    0,
    5
  );

  return (
    <GlassCard className="p-5" radius="lg">
      {/* "Ver todos" no cabeçalho, não mais um botão de largura total
          abaixo da lista — mesma posição do laboratório (page.tsx:388-397,
          "Objetivos" + "Ver todos" na mesma linha). */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {/* Mesmo tratamento do estado vazio acima — ver comentário lá. */}
          <h2 className="card-title">Objetivos</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {concluidos}/{todos} concluídos
          </p>
        </div>
        {allDone ? (
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{
              background: "rgb(var(--accent-rgb) / 0.15)",
              color: "var(--accent)",
              border: "1px solid rgb(var(--accent-rgb) / 0.3)",
            }}
          >
            🎉 Todos feitos!
          </span>
        ) : (
          <button
            onClick={onGoToMetas}
            // Achado #131: era exatamente este botão que o FAB cobria em
            // 390px, sem o usuário precisar rolar — marca pro FAB recuar
            // se colidir (ver FAB.tsx, useFabCollisionAvoidance).
            data-fab-avoid
            className="flex items-center gap-0.5 font-bold shrink-0"
            style={{
              fontSize: "11px",
              color: "var(--accent)",
              minHeight: "44px",
              padding: "0 4px",
            }}
          >
            Ver todos
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {visible.map((obj) => (
          <button
            key={obj.id}
            onClick={() => onToggle(obj.id, !obj.concluido)}
            // Achado #131: marca de conclusão também é uma ação real —
            // recua o FAB se colidir (ver FAB.tsx).
            data-fab-avoid
            className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
            style={{
              background: obj.concluido
                ? "rgb(var(--accent-rgb) / 0.06)"
                : "var(--surface)",
              border: `1px solid ${obj.concluido ? "rgb(var(--accent-rgb) / 0.2)" : "var(--border-color)"}`,
              // minHeight: 44px — alvo de toque mínimo (spec); px-3 py-2.5
              // + text-sm sozinho renderiza ~40px.
              minHeight: "44px",
            }}
          >
            <div
              className="shrink-0 flex items-center justify-center rounded-full border-2 transition-all"
              style={{
                width: 20,
                height: 20,
                borderColor: obj.concluido
                  ? "var(--accent)"
                  : "var(--border-color)",
                background: obj.concluido ? "var(--accent)" : "transparent",
              }}
            >
              {obj.concluido && (
                <Check size={11} color="white" strokeWidth={3} />
              )}
            </div>
            <span
              className="text-sm font-medium flex-1 truncate"
              style={{
                color: obj.concluido ? "var(--text-muted)" : "var(--text)",
                textDecoration: obj.concluido ? "line-through" : "none",
              }}
            >
              {OBJ_CAT_EMOJIS[obj.categoria] ?? "📌"} {obj.titulo}
            </span>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
