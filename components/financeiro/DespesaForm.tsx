"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

const CATEGORIAS = [
  { id: "alimentacao", label: "Alimentação", emoji: "🍽️" },
  { id: "transporte", label: "Transporte", emoji: "🚗" },
  { id: "moradia", label: "Moradia", emoji: "🏠" },
  { id: "saude", label: "Saúde", emoji: "🏥" },
  { id: "educacao", label: "Educação", emoji: "📚" },
  { id: "lazer", label: "Lazer", emoji: "🎮" },
  { id: "vestuario", label: "Vestuário", emoji: "👕" },
  { id: "marketing", label: "Marketing", emoji: "📣" },
  { id: "ferramentas", label: "Ferramentas", emoji: "💻" },
  { id: "equipamentos", label: "Equipamentos", emoji: "🔧" },
  { id: "impostos", label: "Impostos", emoji: "📋" },
  { id: "internet", label: "Internet", emoji: "📡" },
  { id: "combustivel", label: "Combustível", emoji: "⛽" },
  { id: "outros", label: "Outros", emoji: "📦" },
];

interface Props {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function DespesaForm({ open, userId, onClose, onSaved }: Props) {
  const toast = useToast();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("outros");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const v = parseFloat(valor.replace(",", "."));
    if (!descricao.trim() || isNaN(v) || v <= 0) {
      toast.error("Preencha descrição e valor válido.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("despesas").insert({
      user_id: userId,
      descricao: descricao.trim(),
      valor: v,
      categoria,
      data,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao salvar despesa.");
      return;
    }
    setDescricao("");
    setValor("");
    setCategoria("outros");
    setData(new Date().toISOString().slice(0, 10));
    onSaved();
    onClose();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[200]"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
          }}
          onClick={onClose}
        />
      )}

      <div
        className="fixed left-0 right-0 z-[200] rounded-t-[28px] px-4 pt-5 pb-8 max-h-[90vh] overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: 0,
          transform: open ? "translateY(0)" : "translateY(105%)",
          background: "var(--bg)",
          border: "1px solid var(--border-color)",
          borderBottom: "none",
        }}
      >
        <div
          className="mx-auto mb-5 rounded-full"
          style={{ width: 36, height: 4, background: "var(--surface-2)" }}
        />

        <div className="flex items-center justify-between mb-5">
          <h3
            className="font-bold text-[18px]"
            style={{ color: "var(--text)" }}
          >
            Nova Despesa
          </h3>
          {/* 44×44px — alvo de toque mínimo; era 34×34px (achado P1-5). */}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, background: "var(--surface)" }}
          >
            <X size={16} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <p
          className="text-xs font-bold uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Categoria
        </p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {CATEGORIAS.map((c) => {
            const active = categoria === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategoria(c.id)}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                style={{
                  background: active
                    ? "rgb(var(--accent-rgb) / 0.15)"
                    : "var(--surface)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                  fontSize: "9px",
                  fontWeight: 600,
                  color: active ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <span style={{ fontSize: 18 }}>{c.emoji}</span>
                {c.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          placeholder="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full rounded-xl px-4 py-3 mb-3 text-sm font-medium outline-none"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
            color: "var(--text)",
          }}
        />

        <div className="grid grid-cols-2 gap-3 mb-5">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="rounded-xl px-4 py-3 text-sm font-medium outline-none"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-color)",
              color: "var(--text)",
            }}
          />
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-xl px-4 py-3 text-sm font-medium outline-none"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-color)",
              color: "var(--text)",
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
          style={{
            background: "var(--accent)",
            color: "#fff",
            boxShadow: "var(--glow)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Salvando..." : "Salvar Despesa"}
        </button>
      </div>
    </>
  );
}
