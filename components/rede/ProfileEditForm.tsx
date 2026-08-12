"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface FormState {
  nomeExibicao: string;
  bio: string;
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
  open: boolean;
  initial: FormState;
  onClose: () => void;
  onSave: (data: FormState) => void;
}

/** Edita nome de exibição e bio do perfil da Rede -- criado silenciosamente
 * com padrões (nome da conta, sem bio) na primeira visita, então precisa de
 * algum jeito de personalizar depois. */
export function ProfileEditForm({ open, initial, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Editar perfil"
      largeCloseTarget
      footer={
        <button
          onClick={() => onSave(form)}
          disabled={!form.nomeExibicao.trim()}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          Salvar alterações
        </button>
      }
    >
      <div className="px-5 py-5 space-y-4">
        <div>
          <label style={labelStyle}>Nome de exibição</label>
          <input
            style={inputStyle}
            placeholder="Como você quer aparecer na Rede"
            value={form.nomeExibicao}
            onChange={(e) => set("nomeExibicao", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Bio</label>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: "none" }}
            placeholder="Conte um pouco sobre você"
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
