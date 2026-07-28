"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { SkeletonList } from "./Skeleton";
import { findUser, type Conversation } from "@/lib/mockRede";

interface Props {
  conversations: Conversation[];
  onBack: () => void;
  onOpenThread: (conversationId: string) => void;
}

export function ChatListScreen({ conversations, onBack, onOpenThread }: Props) {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 420);
    return () => clearTimeout(t);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (q.length === 0) return conversations;
    return conversations.filter((c) => {
      const user = findUser(c.userId);
      return (
        user?.nome.toLowerCase().includes(q) ||
        c.ultimaMensagem.toLowerCase().includes(q)
      );
    });
  }, [conversations, q]);

  return (
    <div className="pb-4">
      <ScreenHeader title="Conversas" onBack={onBack} />

      {!loading && conversations.length > 0 && (
        <div
          className="flex items-center gap-2.5 px-4 mb-4"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-pill)",
            height: 42,
          }}
        >
          <Search size={15} style={{ color: "var(--text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversas…"
            className="flex-1 text-sm h-full"
            style={{ background: "transparent", color: "var(--text)" }}
          />
        </div>
      )}

      {loading ? (
        <SkeletonList rows={4} />
      ) : conversations.length === 0 ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--text-muted)" }}
        >
          Nenhuma conversa ainda.
        </p>
      ) : filtered.length === 0 ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--text-muted)" }}
        >
          Nada encontrado para &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((c) => {
            const user = findUser(c.userId);
            if (!user) return null;
            return (
              <button
                key={c.id}
                onClick={() => onOpenThread(c.id)}
                className="flex items-center gap-3 w-full py-3 text-left transition-opacity active:opacity-70"
              >
                <Avatar nome={user.nome} cor={user.cor} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {user.nome}
                    </p>
                    <span
                      className="text-[11px] shrink-0"
                      style={{
                        color:
                          c.naoLidas > 0 ? "var(--accent)" : "var(--text-2)",
                        fontWeight: c.naoLidas > 0 ? 700 : 400,
                      }}
                    >
                      {c.hora}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className="text-xs truncate"
                      style={{
                        color: "var(--text-2)",
                        fontWeight: c.naoLidas > 0 ? 600 : 400,
                      }}
                    >
                      {c.ultimaMensagem}
                    </p>
                    {c.naoLidas > 0 && (
                      <span
                        className="flex items-center justify-center rounded-full font-bold shrink-0"
                        style={{
                          minWidth: 18,
                          height: 18,
                          padding: "0 4px",
                          fontSize: 10,
                          background: "var(--accent)",
                          color: "#fff",
                        }}
                      >
                        {c.naoLidas}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
