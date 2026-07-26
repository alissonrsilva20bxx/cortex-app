"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Cliente, ClienteStatus } from "@/lib/mockRede";

interface FormState {
  nome: string;
  telefone: string;
  status: ClienteStatus;
  etiquetas: string;
  observacoes: string;
}

const EMPTY: FormState = {
  nome: "",
  telefone: "",
  status: "ativo",
  etiquetas: "",
  observacoes: "",
};

function clienteToForm(c: Cliente): FormState {
  return {
    nome: c.nome,
    telefone: c.telefone,
    status: c.status,
    etiquetas: c.etiquetas.join(", "),
    observacoes: c.observacoes,
  };
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

const STATUS_OPTIONS: { id: ClienteStatus; label: string }[] = [
  { id: "ativo", label: "Ativo" },
  { id: "vip", label: "VIP" },
  { id: "em-negociacao", label: "Negociação" },
  { id: "pausado", label: "Pausado" },
];

interface Props {
  open: boolean;
  cliente: Cliente | null;
  onClose: () => void;
  onSave: (data: FormState, existing: Cliente | null) => void;
}

export function ClienteForm({ open, cliente, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (open) setForm(cliente ? clienteToForm(cliente) : EMPTY);
  }, [open, cliente]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={cliente ? "Editar cliente" : "Novo cliente"}
      footer={
        <button
          onClick={() => onSave(form, cliente)}
          disabled={!form.nome.trim()}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {cliente ? "Salvar alterações" : "Adicionar cliente"}
        </button>
      }
    >
      <div
        className="px-5 py-5 space-y-4"
        style={{ maxHeight: "60dvh", overflowY: "auto" }}
      >
        <div>
          <label style={labelStyle}>Nome</label>
          <input
            style={inputStyle}
            placeholder="Nome do cliente"
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Telefone</label>
          <input
            style={inputStyle}
            placeholder="(11) 99999-0000"
            value={form.telefone}
            onChange={(e) => set("telefone", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => set("status", id)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background:
                    form.status === id
                      ? "rgb(var(--accent-rgb) / 0.18)"
                      : "var(--surface)",
                  border: `1px solid ${form.status === id ? "var(--accent)" : "var(--border-color)"}`,
                  color:
                    form.status === id ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Etiquetas (separadas por vírgula)</label>
          <input
            style={inputStyle}
            placeholder="fidelizada, indicação"
            value={form.etiquetas}
            onChange={(e) => set("etiquetas", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Observações</label>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: "none" }}
            placeholder="Preferências, alergias, combinados…"
            value={form.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
