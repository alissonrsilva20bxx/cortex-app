"use client";

import { useState, useEffect } from "react";
import { FileText, Image, File, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Categoria =
  | "todos"
  | "comprovantes"
  | "conversas"
  | "documentos"
  | "pessoal";

const CATS: { id: Categoria; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "comprovantes", label: "Comprovantes" },
  { id: "conversas", label: "Conversas" },
  { id: "documentos", label: "Documentos" },
  { id: "pessoal", label: "Pessoal" },
];

interface CofreFile {
  name: string;
  path: string;
  categoria: string;
  size: number;
  createdAt: string;
  mimeType?: string;
}

function FileIcon({ mime }: { mime?: string }) {
  if (mime?.startsWith("image/"))
    return <Image size={20} style={{ color: "var(--accent)" }} />;
  if (mime?.includes("pdf") || mime?.includes("document"))
    return <FileText size={20} style={{ color: "var(--accent)" }} />;
  return <File size={20} style={{ color: "var(--accent)" }} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

interface Props {
  userId: string;
  refreshTrigger: number;
}

export function CofreTab({ userId, refreshTrigger }: Props) {
  const [files, setFiles] = useState<CofreFile[]>([]);
  const [filter, setFilter] = useState<Categoria>("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const cats = ["comprovantes", "conversas", "documentos", "pessoal"];
    Promise.all(
      cats.map((cat) =>
        supabase.storage
          .from("cofre")
          .list(`${userId}/${cat}`, {
            sortBy: { column: "created_at", order: "desc" },
          })
          .then(({ data }) =>
            (data ?? []).map((f) => ({
              name: f.name,
              path: `${userId}/${cat}/${f.name}`,
              categoria: cat,
              size: f.metadata?.size ?? 0,
              createdAt:
                f.created_at ?? f.updated_at ?? new Date().toISOString(),
              mimeType: f.metadata?.mimetype,
            }))
          )
      )
    ).then((results) => {
      const all = results
        .flat()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      setFiles(all);
      setLoading(false);
    });
  }, [userId, refreshTrigger]);

  async function openFile(path: string) {
    const { data } = await supabase.storage
      .from("cofre")
      .createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const filtered =
    filter === "todos" ? files : files.filter((f) => f.categoria === filter);

  return (
    <div className="pb-4">
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
        Cofre
      </h2>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
        {CATS.map(({ id, label }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
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

      {/* List */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <p
            className="text-sm text-center pt-12"
            style={{ color: "var(--text-muted)" }}
          >
            {filter === "todos"
              ? "Cofre vazio. Toque no + para enviar."
              : `Nenhum arquivo em "${CATS.find((c) => c.id === filter)?.label}".`}
          </p>
        ) : (
          filtered.map((f) => (
            <button
              key={f.path}
              onClick={() => openFile(f.path)}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-left transition-opacity active:opacity-70"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                className="p-2 rounded-xl shrink-0"
                style={{ background: "rgb(var(--accent-rgb) / 0.1)" }}
              >
                <FileIcon mime={f.mimeType} />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--text)" }}
                >
                  {f.name}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {CATS.find((c) => c.id === f.categoria)?.label} ·{" "}
                  {formatSize(f.size)} · {formatDate(f.createdAt)}
                </p>
              </div>

              <ExternalLink
                size={14}
                className="shrink-0"
                style={{ color: "var(--text-muted)" }}
              />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
