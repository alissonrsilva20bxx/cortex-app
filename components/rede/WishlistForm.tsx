"use client";

import { useEffect, useState } from "react";
import { Share2, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Privacidade, WishlistEstado, WishlistItem } from "@/lib/mockRede";

const PALETTE = [
  "#FF7AB6",
  "#7AA7FF",
  "#FFC24B",
  "#6EE7B7",
  "#C4B5FD",
  "#FCA5A5",
];

interface FormState {
  nome: string;
  valorAlvo: string;
  valorAtual: string;
  estado: WishlistEstado;
  privacidade: Privacidade;
}

const EMPTY: FormState = {
  nome: "",
  valorAlvo: "",
  valorAtual: "",
  estado: "quero",
  privacidade: "privado",
};

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  color: "var(--text)",
  fontSize: "15px",
  padding: "12px 14px",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: "6px",
};

interface Props {
  open: boolean;
  item: WishlistItem | null;
  onClose: () => void;
  onSave: (data: FormState, existing: WishlistItem | null) => void;
  onShareToFeed: (item: WishlistItem) => void;
  onDeleteRequest: (item: WishlistItem) => void;
}

export function WishlistForm({
  open,
  item,
  onClose,
  onSave,
  onShareToFeed,
  onDeleteRequest,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      item
        ? {
            nome: item.nome,
            valorAlvo: String(item.valorAlvo),
            valorAtual: String(item.valorAtual),
            estado: item.estado,
            privacidade: item.privacidade,
          }
        : EMPTY
    );
  }, [open, item]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={item ? "Editar desejo" : "Novo desejo"}
      footer={
        <div className="space-y-2">
          {item && (
            <button
              onClick={() => onShareToFeed(item)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-semibold text-sm transition-opacity active:opacity-80"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
                color: "var(--text)",
              }}
            >
              <Share2 size={15} />
              Compartilhar no Feed
            </button>
          )}
          <button
            onClick={() => onSave(form, item)}
            disabled={!form.nome.trim() || !form.valorAlvo}
            className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {item ? "Salvar alterações" : "Adicionar desejo"}
          </button>
          {item && (
            <button
              onClick={() => onDeleteRequest(item)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-semibold text-sm transition-opacity active:opacity-80"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={15} />
              Excluir desejo
            </button>
          )}
        </div>
      }
    >
      <div
        className="px-5 py-5 space-y-4"
        style={{ maxHeight: "60dvh", overflowY: "auto" }}
      >
        <div>
          <label style={labelStyle}>O que você deseja</label>
          <input
            style={inputStyle}
            placeholder="Ex: Cadeira hidráulica"
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Valor alvo (R$)</label>
            <input
              type="number"
              min="0"
              style={inputStyle}
              placeholder="0"
              value={form.valorAlvo}
              onChange={(e) => set("valorAlvo", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Já guardado (R$)</label>
            <input
              type="number"
              min="0"
              style={inputStyle}
              placeholder="0"
              value={form.valorAtual}
              onChange={(e) => set("valorAtual", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Estado</label>
          <div className="flex gap-2">
            {(["quero", "planejando", "conquistado"] as WishlistEstado[]).map(
              (e) => (
                <button
                  key={e}
                  onClick={() => set("estado", e)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all capitalize"
                  style={{
                    background:
                      form.estado === e
                        ? "rgb(var(--accent-rgb) / 0.18)"
                        : "var(--surface)",
                    border: `1px solid ${form.estado === e ? "var(--accent)" : "var(--border-color)"}`,
                    color:
                      form.estado === e ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {e}
                </button>
              )
            )}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Privacidade</label>
          <div className="flex gap-2">
            {(
              [
                { id: "privado", label: "Privado" },
                { id: "amigas", label: "Amigas" },
                { id: "comunidade", label: "Comunidade" },
              ] as { id: Privacidade; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => set("privacidade", id)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background:
                    form.privacidade === id
                      ? "rgb(var(--accent-rgb) / 0.18)"
                      : "var(--surface)",
                  border: `1px solid ${form.privacidade === id ? "var(--accent)" : "var(--border-color)"}`,
                  color:
                    form.privacidade === id
                      ? "var(--accent)"
                      : "var(--text-muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

export const WISHLIST_PALETTE = PALETTE;
