"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { LiveLink } from "@/lib/mockRede";

interface FormState {
  label: string;
  url: string;
}

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
  link: LiveLink | null;
  onClose: () => void;
  onSave: (id: string, data: FormState) => void;
}

/** Editor de rótulo/URL de um LiveLink — o catálogo de 5 plataformas é fixo,
 * só o texto de cada uma é customizável (sem criar/excluir aqui). */
export function LiveLinkForm({ link, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>({ label: "", url: "" });

  useEffect(() => {
    if (link) setForm({ label: link.label, url: link.url });
  }, [link]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <BottomSheet
      open={!!link}
      onClose={onClose}
      title="Editar LiveLink"
      footer={
        <button
          onClick={() => link && onSave(link.id, form)}
          disabled={!form.label.trim() || !form.url.trim()}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          Salvar alterações
        </button>
      }
    >
      <div className="px-5 py-5 space-y-4">
        <div>
          <label style={labelStyle}>Rótulo</label>
          <input
            style={inputStyle}
            placeholder="Ex: Fale comigo no WhatsApp"
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Link</label>
          <input
            style={inputStyle}
            placeholder="Ex: wa.me/5511999999999"
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
