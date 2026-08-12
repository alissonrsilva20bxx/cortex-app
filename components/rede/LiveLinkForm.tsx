"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { LiveLink } from "./LiveLinksSection";

interface FormState {
  titulo: string;
  url: string;
}

const EMPTY: FormState = { titulo: "", url: "" };

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
  link: LiveLink | null;
  onClose: () => void;
  onSave: (data: FormState, existing: LiveLink | null) => void;
}

/** Cria ou edita um LiveLink -- `link` distingue os dois modos, mas quem
 * controla se o sheet está aberto é `open` (precisa ser separado de `link`
 * porque criar um novo também parte de `link: null`). */
export function LiveLinkForm({ open, link, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (open) setForm(link ? { titulo: link.titulo, url: link.url } : EMPTY);
  }, [open, link]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      largeCloseTarget
      title={link ? "Editar LiveLink" : "Novo LiveLink"}
      footer={
        <button
          onClick={() => onSave(form, link)}
          disabled={!form.titulo.trim() || !form.url.trim()}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {link ? "Salvar alterações" : "Adicionar LiveLink"}
        </button>
      }
    >
      <div className="px-5 py-5 space-y-4">
        <div>
          <label style={labelStyle}>Título</label>
          <input
            style={inputStyle}
            placeholder="Ex: Meu Instagram"
            value={form.titulo}
            onChange={(e) => set("titulo", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Link</label>
          <input
            style={inputStyle}
            placeholder="https://instagram.com/seuusuario"
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
