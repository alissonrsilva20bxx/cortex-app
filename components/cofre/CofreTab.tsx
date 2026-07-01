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

const CAT_COLORS: Record<string, string> = {
  comprovantes: "#50dc78",
  conversas: "#64b4ff",
  documentos: "var(--accent)",
  pessoal: "#c084fc",
};

interface CofreFile {
  name: string;
  path: string;
  categoria: string;
  size: number;
  createdAt: string;
  mimeType?: string;
}

function FileIcon({ mime }: { mime?: string }) {
  const style = { color: "var(--accent)" };
  if (mime?.startsWith("image/"))
    return <Image size={18} style={style} aria-hidden="true" />;
  if (mime?.includes("pdf") || mime?.includes("document"))
    return <FileText size={18} style={style} aria-hidden="true" />;
  return <File size={18} style={style} aria-hidden="true" />;
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
                boxShadow: active ? "var(--glow-sm)" : "none",
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
              className="glass-card flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-left transition-all active:opacity-70 active:scale-[0.99]"
            >
              {/* File icon with glow container */}
              <div
                className="p-2.5 rounded-xl shrink-0"
                style={{
                  background: "rgb(var(--accent-rgb) / 0.1)",
                  border: "1px solid rgb(var(--accent-rgb) / 0.15)",
                  boxShadow: "0 0 10px rgb(var(--accent-rgb) / 0.12)",
                }}
              >
                <FileIcon mime={f.mimeType} />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {f.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-px rounded-full"
                    style={{
                      background: `${CAT_COLORS[f.categoria] ?? "var(--accent)"}18`,
                      color: CAT_COLORS[f.categoria] ?? "var(--accent)",
                      border: `1px solid ${CAT_COLORS[f.categoria] ?? "var(--accent)"}30`,
                    }}
                  >
                    {CATS.find((c) => c.id === f.categoria)?.label}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatSize(f.size)} · {formatDate(f.createdAt)}
                  </span>
                </div>
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
