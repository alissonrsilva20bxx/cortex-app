"use client";

import { Check, ChevronRight } from "lucide-react";
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

export function ObjetivosCard({ objetivos, onToggle, onGoToMetas }: Props) {
  if (objetivos.length === 0) return null;

  const pendentes = objetivos.filter((o) => !o.concluido);
  const todos = objetivos.length;
  const concluidos = todos - pendentes.length;
  const allDone = concluidos === todos;

  const visible = [...pendentes, ...objetivos.filter((o) => o.concluido)].slice(
    0,
    5
  );

  return (
    <div className="glass-card rounded-[22px] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-label">Objetivos</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {concluidos}/{todos} concluídos
          </p>
        </div>
        {allDone && (
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
        )}
      </div>

      <div className="space-y-2 mb-4">
        {visible.map((obj) => (
          <button
            key={obj.id}
            onClick={() => onToggle(obj.id, !obj.concluido)}
            className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
            style={{
              background: obj.concluido
                ? "rgb(var(--accent-rgb) / 0.06)"
                : "var(--surface)",
              border: `1px solid ${obj.concluido ? "rgb(var(--accent-rgb) / 0.2)" : "var(--border-color)"}`,
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

      <button
        onClick={onGoToMetas}
        className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
        style={{
          background: "rgb(var(--accent-rgb) / 0.08)",
          color: "var(--accent)",
          border: "1px solid rgb(var(--accent-rgb) / 0.2)",
        }}
      >
        Ver todos
        <ChevronRight size={13} />
      </button>
    </div>
  );
}
