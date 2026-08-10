"use client";

import { useState } from "react";
import { Plus, Check, Target } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { calcEarnings, formatBRL } from "@/lib/finance";
import { PERIODO_LABELS, OBJ_CATS } from "./constants";
import type { Job, Meta, ReceitaAvulsa, Objetivo } from "@/lib/types";

/**
 * Superfície sólida — mesmo padrão dos outros arquivos de Financeiro
 * (T4), Início (T2) e Agenda (T3).
 */
const SOLID_SURFACE_STYLE = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
  border: "1px solid var(--border-color)",
} as const;

/**
 * Título de seção — 13px/semibold/-0.035em, cor plena, mesmo tratamento
 * já usado pros títulos de card de Início/Agenda (não `.section-label`,
 * o eyebrow uppercase cuja causa-raiz foi corrigida em T2). "Metas
 * Financeiras" e "Objetivos de Vida" encabeçam cada seu próprio
 * `GlassCard`, mesma proeminência de "Próximo atendimento"/"Objetivos"
 * no Início.
 */
const sectionTitleStyle = {
  fontSize: "13px",
  letterSpacing: "-0.035em",
  color: "var(--text)",
} as const;

interface Props {
  jobs: Job[];
  receitas: ReceitaAvulsa[];
  metas: Meta[];
  objetivos: Objetivo[];
  userId: string;
  onObjetivoAdded: () => void;
  onToggleObjetivo: (id: string, done: boolean) => Promise<void>;
}

const PERIODO_ORDER = ["dia", "mes", "ano"];

export function MetasTab({
  jobs,
  receitas,
  metas,
  objetivos,
  userId,
  onObjetivoAdded,
  onToggleObjetivo,
}: Props) {
  const [objTitulo, setObjTitulo] = useState("");
  const [objCat, setObjCat] = useState("afazeres");
  const [objSaving, setObjSaving] = useState(false);
  const [objFormOpen, setObjFormOpen] = useState(false);

  async function saveObjetivo() {
    if (!objTitulo.trim()) return;
    setObjSaving(true);
    await supabase.from("objetivos").insert({
      user_id: userId,
      titulo: objTitulo.trim(),
      categoria: objCat,
    });
    setObjSaving(false);
    setObjTitulo("");
    setObjCat("afazeres");
    setObjFormOpen(false);
    onObjetivoAdded();
  }

  return (
    <div className="space-y-4">
      {/* Metas financeiras */}
      <GlassCard radius="md" className="p-4" style={SOLID_SURFACE_STYLE}>
        <div className="flex items-center gap-2 mb-4">
          <Target size={14} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={sectionTitleStyle}>
            Metas Financeiras
          </h2>
        </div>
        <div className="flex flex-col gap-5">
          {[...metas]
            .sort(
              (a, b) =>
                PERIODO_ORDER.indexOf(a.periodo) -
                PERIODO_ORDER.indexOf(b.periodo)
            )
            .map((meta) => {
              const current = calcEarnings(jobs, receitas, meta.periodo);
              const pct = Math.min(100, (current / meta.valorAlvo) * 100);
              const done = pct >= 100;
              return (
                <div key={meta.periodo}>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--text)" }}
                      >
                        {PERIODO_LABELS[meta.periodo]}
                      </span>
                      {done && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-px rounded-full"
                          style={{
                            background: "rgb(var(--accent-rgb) / 0.15)",
                            color: "var(--accent)",
                            border: "1px solid rgb(var(--accent-rgb) / 0.3)",
                          }}
                        >
                          ✓ Meta
                        </span>
                      )}
                    </div>
                    <span
                      className="text-xs tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatBRL(current)} / {formatBRL(meta.valorAlvo)}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </GlassCard>

      {/* Objetivos de vida */}
      <GlassCard radius="md" className="p-4" style={SOLID_SURFACE_STYLE}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>🌟</span>
            <h2 className="font-semibold" style={sectionTitleStyle}>
              Objetivos de Vida
            </h2>
          </div>
          {/* minHeight 44px — era ~28px (px-3 py-1.5 + text-xs). */}
          <button
            onClick={() => setObjFormOpen((v) => !v)}
            className="flex items-center gap-1 px-3 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={{
              minHeight: "44px",
              background: objFormOpen
                ? "var(--accent)"
                : "rgb(var(--accent-rgb) / 0.12)",
              color: objFormOpen ? "#fff" : "var(--accent)",
              border: `1px solid rgb(var(--accent-rgb) / 0.3)`,
            }}
          >
            <Plus size={12} />
            Novo
          </button>
        </div>

        {/* Form inline */}
        {objFormOpen && (
          <div
            className="rounded-2xl p-3 mb-4"
            style={{
              background: "rgb(var(--accent-rgb) / 0.05)",
              border: "1px solid rgb(var(--accent-rgb) / 0.15)",
            }}
          >
            <input
              type="text"
              placeholder="Título do objetivo..."
              value={objTitulo}
              onChange={(e) => setObjTitulo(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 mb-2 text-sm font-medium outline-none"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
                color: "var(--text)",
              }}
            />
            <div className="flex gap-1.5 flex-wrap mb-3">
              {OBJ_CATS.map((c) => (
                // minHeight 44px — alvo de toque mínimo.
                <button
                  key={c.id}
                  onClick={() => setObjCat(c.id)}
                  className="px-2.5 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    minHeight: "44px",
                    background:
                      objCat === c.id ? "var(--accent)" : "var(--surface)",
                    color: objCat === c.id ? "#fff" : "var(--text-muted)",
                    border: `1px solid ${objCat === c.id ? "var(--accent)" : "var(--border-color)"}`,
                  }}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            {/* minHeight 44px em ambos — eram ~24px (py-2 + text-xs). */}
            <div className="flex gap-2">
              <button
                onClick={() => setObjFormOpen(false)}
                className="flex-1 rounded-xl text-xs font-bold"
                style={{
                  minHeight: "44px",
                  background: "var(--surface)",
                  color: "var(--text-muted)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={saveObjetivo}
                disabled={objSaving || !objTitulo.trim()}
                className="flex-1 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{
                  minHeight: "44px",
                  background: "var(--accent)",
                  color: "#fff",
                  opacity: objSaving || !objTitulo.trim() ? 0.6 : 1,
                }}
              >
                {objSaving ? "..." : "Salvar"}
              </button>
            </div>
          </div>
        )}

        {objetivos.length === 0 ? (
          <p
            className="text-sm text-center py-6"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhum objetivo ainda. Toque em + Novo para criar.
          </p>
        ) : (
          <div className="space-y-2">
            {objetivos.map((obj) => (
              <button
                key={obj.id}
                onClick={() => onToggleObjetivo(obj.id, !obj.concluido)}
                className="flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl transition-all active:scale-[0.98]"
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
                    width: 22,
                    height: 22,
                    borderColor: obj.concluido
                      ? "var(--accent)"
                      : "var(--border-color)",
                    background: obj.concluido ? "var(--accent)" : "transparent",
                  }}
                >
                  {obj.concluido && (
                    <Check size={12} color="white" strokeWidth={3} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{
                      color: obj.concluido
                        ? "var(--text-muted)"
                        : "var(--text)",
                      textDecoration: obj.concluido ? "line-through" : "none",
                    }}
                  >
                    {obj.titulo}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {OBJ_CATS.find((c) => c.id === obj.categoria)?.emoji}{" "}
                    {OBJ_CATS.find((c) => c.id === obj.categoria)?.label ??
                      obj.categoria}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
