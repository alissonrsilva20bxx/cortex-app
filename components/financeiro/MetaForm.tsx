"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PeriodoMeta } from "@/lib/types";

interface MetaValues {
  dia: string;
  mes: string;
  ano: string;
}

interface Props {
  open: boolean;
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

const ROWS: { periodo: PeriodoMeta; label: string; hint: string }[] = [
  { periodo: "dia", label: "Meta diária (R$)", hint: "Ex: 300" },
  { periodo: "mes", label: "Meta mensal (R$)", hint: "Ex: 3.000" },
  { periodo: "ano", label: "Meta anual (R$)", hint: "Ex: 36.000" },
];

export function MetaForm({ open, userId, onClose, onSaved }: Props) {
  const [values, setValues] = useState<MetaValues>({
    dia: "",
    mes: "",
    ano: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    supabase
      .from("metas")
      .select("periodo, valor_alvo")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!data) return;
        const vals: MetaValues = { dia: "", mes: "", ano: "" };
        data.forEach((r) => {
          vals[r.periodo as PeriodoMeta] = String(r.valor_alvo);
        });
        setValues(vals);
      });
  }, [open, userId]);

  async function handleSave() {
    const parsed = {
      dia: parseFloat(values.dia),
      mes: parseFloat(values.mes),
      ano: parseFloat(values.ano),
    };
    if (Object.values(parsed).some((v) => isNaN(v) || v < 0)) {
      return setError("Todos os valores precisam ser números válidos.");
    }
    setSaving(true);
    setError(null);

    const rows = (["dia", "mes", "ano"] as PeriodoMeta[]).map((p) => ({
      user_id: userId,
      periodo: p,
      valor_alvo: parsed[p],
    }));

    const { error: err } = await supabase
      .from("metas")
      .upsert(rows, { onConflict: "user_id,periodo" });

    setSaving(false);
    if (err) return setError(err.message);
    onSaved();
    onClose();
  }

  return (
    <>
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

      <div
        className="fixed left-0 right-0 z-50 rounded-t-3xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: 0,
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
            Editar Metas
          </p>
          <button onClick={onClose} className="p-1 mt-2 active:opacity-70">
            <X size={20} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {ROWS.map(({ periodo, label, hint }) => (
            <div key={periodo}>
              <label style={labelStyle}>{label}</label>
              <input
                type="number"
                min="0"
                step="1"
                style={inputStyle}
                placeholder={hint}
                value={values[periodo]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [periodo]: e.target.value }))
                }
              />
            </div>
          ))}

          {error && (
            <p className="text-sm" style={{ color: "#ff5050" }}>
              {error}
            </p>
          )}
        </div>

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
            {saving ? "Salvando…" : "Salvar metas"}
          </button>
        </div>
      </div>
    </>
  );
}
