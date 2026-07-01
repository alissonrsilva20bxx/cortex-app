"use client";

import { useState, useRef } from "react";
import { X, FileUp, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Categoria = "comprovantes" | "conversas" | "documentos" | "pessoal";

const CATS: { id: Categoria; label: string }[] = [
  { id: "comprovantes", label: "Comprovantes" },
  { id: "conversas", label: "Conversas" },
  { id: "documentos", label: "Documentos" },
  { id: "pessoal", label: "Pessoal" },
];

interface Props {
  open: boolean;
  userId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadSheet({ open, userId, onClose, onUploaded }: Props) {
  const [categoria, setCategoria] = useState<Categoria>("documentos");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    setFile(null);
    setError(null);
    onClose();
  }

  async function handleUpload() {
    if (!file) return setError("Selecione um arquivo.");
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${userId}/${categoria}/${Date.now()}.${ext}`;
    const { error: err } = await supabase.storage
      .from("cofre")
      .upload(path, file, { contentType: file.type });
    setUploading(false);
    if (err) return setError(err.message);
    setFile(null);
    onUploaded();
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
          onClick={handleClose}
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
            Enviar arquivo
          </p>
          <button onClick={handleClose} className="p-1 mt-2 active:opacity-70">
            <X size={20} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Categoria */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              Categoria
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATS.map(({ id, label }) => {
                const active = categoria === id;
                return (
                  <button
                    key={id}
                    onClick={() => setCategoria(id)}
                    className="py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: active
                        ? "rgb(var(--accent-rgb) / 0.18)"
                        : "var(--surface)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                      color: active ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* File picker */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              Arquivo
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => {
                setError(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-3 w-full px-4 py-4 rounded-2xl transition-opacity active:opacity-70"
              style={{
                background: "var(--surface)",
                border: `1px solid ${file ? "var(--accent)" : "var(--border-color)"}`,
              }}
            >
              {file ? (
                <CheckCircle size={20} style={{ color: "var(--accent)" }} />
              ) : (
                <FileUp size={20} style={{ color: "var(--text-muted)" }} />
              )}
              <span
                className="text-sm truncate text-left"
                style={{ color: file ? "var(--text)" : "var(--text-muted)" }}
              >
                {file ? file.name : "Selecionar arquivo…"}
              </span>
              {file && (
                <span
                  className="ml-auto text-xs shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </button>
          </div>

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
            onClick={handleUpload}
            disabled={uploading || !file}
            className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-40"
            style={{ background: "var(--accent)", color: "white" }}
          >
            {uploading ? "Enviando…" : "Enviar para o cofre"}
          </button>
        </div>
      </div>
    </>
  );
}
