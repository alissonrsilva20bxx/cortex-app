"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Privacidade, WishlistEstado } from "@/lib/mockRede";
import type { WishlistItem } from "@/lib/rede/wishlist";
import { TEXTOS_DESEJO as T } from "@/lib/desejo/textos";
import { formatEUR } from "@/lib/guardar/valor";

export interface DesejoFormState {
  nome: string;
  valorAlvo: string;
  prazo: string;
  estado: WishlistEstado;
  privacidade: Privacidade;
}

const EMPTY: DesejoFormState = {
  nome: "",
  valorAlvo: "",
  prazo: "",
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
  minHeight: "44px",
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

const ESTADOS: WishlistEstado[] = ["quero", "planejando", "conquistado"];
const PRIVACIDADES: Privacidade[] = ["privado", "amigas", "comunidade"];

interface Props {
  open: boolean;
  item: WishlistItem | null;
  onClose: () => void;
  onSave: (data: DesejoFormState, existing: WishlistItem | null) => void;
  onDeleteRequest: (item: WishlistItem) => void;
}

/**
 * Formulário único do Desejo (criar e editar). O dinheiro guardado não é
 * editável aqui: só a ação Guardar soma, para o histórico bater com o total.
 */
export function DesejoForm({
  open,
  item,
  onClose,
  onSave,
  onDeleteRequest,
}: Props) {
  const [form, setForm] = useState<DesejoFormState>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      item
        ? {
            nome: item.nome,
            valorAlvo: String(item.valorAlvo),
            prazo: item.prazo ?? "",
            estado: item.estado,
            privacidade: item.privacidade,
          }
        : EMPTY
    );
  }, [open, item]);

  function set<K extends keyof DesejoFormState>(
    key: K,
    value: DesejoFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const alvoValido = Number(form.valorAlvo) > 0;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={item ? T.formEditar : T.formNovo}
      footer={
        <div className="space-y-2">
          <button
            onClick={() => onSave(form, item)}
            disabled={!form.nome.trim() || !alvoValido}
            className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {item ? T.salvarEdicao : T.salvarNovo}
          </button>
          {item && (
            <button
              onClick={() => onDeleteRequest(item)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-semibold text-sm transition-opacity active:opacity-80"
              style={{ color: "var(--danger)", minHeight: "44px" }}
            >
              <Trash2 size={15} />
              {T.excluir}
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
          <label htmlFor="desejo-nome" style={labelStyle}>
            {T.campoNome}
          </label>
          <input
            id="desejo-nome"
            style={inputStyle}
            placeholder={T.placeholderNome}
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="desejo-alvo" style={labelStyle}>
            {T.campoAlvo}
          </label>
          <input
            id="desejo-alvo"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            style={inputStyle}
            placeholder="0"
            value={form.valorAlvo}
            onChange={(e) => set("valorAlvo", e.target.value)}
          />
          {item && (
            <p
              className="text-xs mt-2"
              style={{ color: "var(--text-muted)" }}
            >
              {T.jaGuardado(formatEUR(item.valorAtual))}. {T.dicaGuardar}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="desejo-prazo" style={labelStyle}>
            {T.campoPrazo}
          </label>
          <div className="flex gap-2">
            <input
              id="desejo-prazo"
              type="date"
              style={inputStyle}
              value={form.prazo}
              onChange={(e) => set("prazo", e.target.value)}
            />
            <button
              type="button"
              onClick={() => set("prazo", "")}
              disabled={!form.prazo}
              className="px-3 rounded-xl text-xs font-semibold shrink-0 disabled:opacity-50"
              style={{
                minHeight: "44px",
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
                color: "var(--text-muted)",
              }}
            >
              {T.semPrazo}
            </button>
          </div>
        </div>

        <div>
          <label style={labelStyle}>{T.estado}</label>
          <div className="flex gap-2">
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => set("estado", e)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  minHeight: "44px",
                  background:
                    form.estado === e
                      ? "rgb(var(--accent-rgb) / 0.18)"
                      : "var(--surface)",
                  border: `1px solid ${form.estado === e ? "var(--accent)" : "var(--border-color)"}`,
                  color:
                    form.estado === e ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {T.estados[e]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>{T.privacidade}</label>
          <div className="flex gap-2">
            {PRIVACIDADES.map((id) => (
              <button
                key={id}
                onClick={() => set("privacidade", id)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  minHeight: "44px",
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
                {T.privacidades[id]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
