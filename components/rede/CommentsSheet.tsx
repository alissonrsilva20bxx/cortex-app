"use client";

import { useState } from "react";
import { Send, MoreHorizontal } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "./Avatar";
import { SkeletonRow } from "./Skeleton";
import { formatRelativeTime } from "@/lib/mockRede";
import type { FeedComment } from "@/lib/rede/feed";

interface Props {
  postId: string | null;
  usuarioNome: string;
  comments: FeedComment[];
  loading: boolean;
  onClose: () => void;
  onAddComment: (postId: string, texto: string) => void;
  onOpenAutor: (autorId: string) => void;
  onReportComment: (comment: FeedComment) => void;
}

export function CommentsSheet({
  postId,
  usuarioNome,
  comments,
  loading,
  onClose,
  onAddComment,
  onOpenAutor,
  onReportComment,
}: Props) {
  const [texto, setTexto] = useState("");

  function handleSend() {
    if (!postId || !texto.trim()) return;
    onAddComment(postId, texto.trim());
    setTexto("");
  }

  return (
    <BottomSheet
      open={!!postId}
      onClose={onClose}
      title="Comentários"
      largeCloseTarget
      footer={
        <div className="flex items-center gap-2">
          <Avatar nome={usuarioNome} size="sm" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escreva um comentário…"
            className="flex-1 text-sm"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-pill)",
              color: "var(--text)",
              padding: "10px 16px",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!texto.trim()}
            aria-label="Enviar comentário"
            className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70 disabled:opacity-40"
            style={{ width: 44, height: 44, background: "var(--accent)" }}
          >
            <Send size={15} color="#fff" />
          </button>
        </div>
      }
    >
      <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "55dvh" }}>
        {loading ? (
          <div className="space-y-3">
            <SkeletonRow withSubtitle={false} />
            <SkeletonRow withSubtitle={false} />
          </div>
        ) : comments.length === 0 ? (
          <p
            className="text-sm text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhum comentário ainda. Seja a primeira!
          </p>
        ) : (
          <div className="space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-3">
                <Avatar
                  nome={c.autorNome}
                  cor={c.autorCor}
                  size="sm"
                  onClick={() => onOpenAutor(c.autorId)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ color: "var(--text)" }}>
                    <span className="font-semibold">{c.autorNome}</span>{" "}
                    <span style={{ color: "var(--text-2)" }}>{c.texto}</span>
                  </p>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatRelativeTime(c.criadoEm)}
                  </p>
                </div>
                <button
                  onClick={() => onReportComment(c)}
                  aria-label="Mais opções"
                  className="flex items-center justify-center shrink-0 active:opacity-60"
                  style={{
                    width: 44,
                    height: 44,
                    margin: "-13px -13px -13px 0",
                  }}
                >
                  <MoreHorizontal
                    size={16}
                    style={{ color: "var(--text-muted)" }}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
