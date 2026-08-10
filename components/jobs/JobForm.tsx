"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Job, JobStatus, Modalidade } from "@/lib/types";

interface FormState {
  clienteNome: string;
  data: string;
  hora: string;
  valor: string;
  modalidade: Modalidade;
  local: string;
  observacoes: string;
  status: JobStatus;
}

const EMPTY: FormState = {
  clienteNome: "",
  data: "",
  hora: "",
  valor: "",
  modalidade: "presencial",
  local: "",
  observacoes: "",
  status: "agendado",
};

function jobToForm(job: Job): FormState {
  return {
    clienteNome: job.clienteNome,
    data: job.data,
    hora: job.hora,
    valor: String(job.valor),
    modalidade: job.modalidade,
    local: job.local ?? "",
    observacoes: job.observacoes ?? "",
    status: job.status,
  };
}

interface Props {
  open: boolean;
  job: Job | null; // null = new job
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  color: "var(--text)",
  fontSize: "15px",
  padding: "12px 14px",
  width: "100%",
  outline: "none",
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

export function JobForm({ open, job, userId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(job ? jobToForm(job) : EMPTY);
      setError(null);
    }
  }, [open, job]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.clienteNome.trim())
      return setError("Nome do cliente obrigatório.");
    if (!form.data) return setError("Data obrigatória.");
    if (!form.hora) return setError("Hora obrigatória.");
    const valor = parseFloat(form.valor);
    if (isNaN(valor) || valor <= 0) return setError("Valor inválido.");
    if (form.modalidade === "presencial" && !form.local.trim())
      return setError("Local obrigatório para atendimento presencial.");

    setSaving(true);
    setError(null);

    const payload = {
      cliente_nome: form.clienteNome.trim(),
      data: form.data,
      hora: form.hora,
      valor,
      modalidade: form.modalidade,
      local:
        form.modalidade === "presencial" ? form.local.trim() || null : null,
      observacoes: form.observacoes.trim() || null,
      status: form.status,
      atualizado_em: new Date().toISOString(),
    };

    let err;
    if (job) {
      ({ error: err } = await supabase
        .from("jobs")
        .update(payload)
        .eq("id", job.id));
    } else {
      ({ error: err } = await supabase
        .from("jobs")
        .insert({ ...payload, user_id: userId }));
    }

    setSaving(false);
    if (err) return setError(err.message);
    onSaved();
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          style={{
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            background: "rgb(var(--bg-rgb) / 0.5)",
          }}
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 z-50 rounded-t-3xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: 0,
          maxHeight: "90dvh",
          transform: open ? "translateY(0)" : "translateY(105%)",
          background: "var(--surface-2)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid var(--border-color)",
          borderBottom: "none",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div
            className="w-9 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-3"
            style={{ background: "var(--border-color)" }}
          />
          <p
            className="font-semibold text-base mt-2"
            style={{ color: "var(--text)" }}
          >
            {job ? "Editar atendimento" : "Novo atendimento"}
          </p>
          {/* minWidth/minHeight 44px — alvo de toque mínimo (spec); o ícone
              de 20px com p-1 sozinho renderiza ~28×28px (achado P1 #5 do
              relatório de paridade visual da Agenda). */}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="mt-2 flex items-center justify-center active:opacity-70"
            style={{ minWidth: "44px", minHeight: "44px" }}
          >
            <X size={20} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
          {/* Cliente */}
          <div>
            <label style={labelStyle}>Cliente</label>
            <input
              style={inputStyle}
              placeholder="Nome do cliente"
              value={form.clienteNome}
              onChange={(e) => set("clienteNome", e.target.value)}
            />
          </div>

          {/* Data + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Data</label>
              <input
                type="date"
                style={inputStyle}
                value={form.data}
                onChange={(e) => set("data", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input
                type="time"
                style={inputStyle}
                value={form.hora}
                onChange={(e) => set("hora", e.target.value)}
              />
            </div>
          </div>

          {/* Valor */}
          <div>
            <label style={labelStyle}>Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              style={inputStyle}
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => set("valor", e.target.value)}
            />
          </div>

          {/* Modalidade */}
          <div>
            <label style={labelStyle}>Modalidade</label>
            <div className="flex gap-2">
              {(["presencial", "online"] as Modalidade[]).map((m) => (
                <button
                  key={m}
                  onClick={() => set("modalidade", m)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all capitalize"
                  style={{
                    background:
                      form.modalidade === m
                        ? "rgb(var(--accent-rgb) / 0.18)"
                        : "var(--surface)",
                    border: `1px solid ${form.modalidade === m ? "var(--accent)" : "var(--border-color)"}`,
                    color:
                      form.modalidade === m
                        ? "var(--accent)"
                        : "var(--text-muted)",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Local (condicional) */}
          {form.modalidade === "presencial" && (
            <div>
              <label style={labelStyle}>Local</label>
              <input
                style={inputStyle}
                placeholder="Endereço ou local"
                value={form.local}
                onChange={(e) => set("local", e.target.value)}
              />
            </div>
          )}

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select
              style={{ ...inputStyle, appearance: "none" }}
              value={form.status}
              onChange={(e) => set("status", e.target.value as JobStatus)}
            >
              <option value="agendado">Agendado</option>
              <option value="confirmado">Confirmado</option>
              <option value="concluído">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: "none" }}
              placeholder="Notas sobre o atendimento..."
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {saving
              ? "Salvando…"
              : job
                ? "Salvar alterações"
                : "Registrar atendimento"}
          </button>
        </div>
      </div>
    </>
  );
}
