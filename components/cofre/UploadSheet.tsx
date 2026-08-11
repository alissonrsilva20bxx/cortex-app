"use client";

import { useState, useRef } from "react";
import { FileUp, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FilterChips } from "@/components/ui/FilterChips";

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
    <BottomSheet
      open={open}
      onClose={handleClose}
      title="Enviar arquivo"
      largeCloseTarget
      footer={
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-40"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {uploading ? "Enviando…" : "Enviar para o cofre"}
        </button>
      }
    >
      <div className="px-5 py-5 space-y-5">
        {/* Categoria */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            Categoria
          </p>
          <FilterChips
            options={CATS}
            value={categoria}
            onChange={setCategoria}
            columns={2}
            minTouchTarget
          />
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
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
