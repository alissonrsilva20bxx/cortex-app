"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "./Avatar";
import { findUser, formatRelativeTime, type RedePost } from "@/lib/mockRede";

interface Props {
  post: RedePost | null;
  usuarioNome: string;
  onClose: () => void;
  onAddComment: (postId: string, texto: string) => void;
  onOpenAutor: (autorId: string) => void;
}

export function CommentsSheet({
  post,
  usuarioNome,
  onClose,
  onAddComment,
  onOpenAutor,
}: Props) {
  const [texto, setTexto] = useState("");

  function handleSend() {
    if (!post || !texto.trim()) return;
    onAddComment(post.id, texto.trim());
    setTexto("");
  }

  return (
    <BottomSheet
      open={!!post}
      onClose={onClose}
      title="Comentários"
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
            style={{ width: 38, height: 38, background: "var(--accent)" }}
          >
            <Send size={15} color="#fff" />
          </button>
        </div>
      }
    >
      <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "55dvh" }}>
        {!post || post.comentarios.length === 0 ? (
          <p
            className="text-sm text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhum comentário ainda. Seja a primeira!
          </p>
        ) : (
          <div className="space-y-4">
            {post.comentarios.map((c) => {
              const isMe = c.autorId === "me";
              const autor = isMe ? null : findUser(c.autorId);
              const nome = isMe ? usuarioNome : (autor?.nome ?? "Usuária");
              return (
                <div key={c.id} className="flex items-start gap-3">
                  <Avatar
                    nome={nome}
                    cor={autor?.cor}
                    size="sm"
                    onClick={isMe ? undefined : () => onOpenAutor(c.autorId)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: "var(--text)" }}>
                      <span className="font-semibold">{nome}</span>{" "}
                      <span style={{ color: "var(--text-2)" }}>{c.texto}</span>
                    </p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatRelativeTime(c.criadoEm)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
