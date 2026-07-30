"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { SkeletonList } from "./Skeleton";
import { formatRelativeTime } from "@/lib/mockRede";
import type { ConversaResumo } from "@/lib/rede/mensagens";

interface Props {
  loading: boolean;
  conversations: ConversaResumo[];
  onBack: () => void;
  onOpenThread: (conversationId: string) => void;
}

export function ChatListScreen({
  loading,
  conversations,
  onBack,
  onOpenThread,
}: Props) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (q.length === 0) return conversations;
    return conversations.filter(
      (c) =>
        c.outroNome.toLowerCase().includes(q) ||
        c.ultimaMensagem.toLowerCase().includes(q)
    );
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
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenThread(c.id)}
              className="flex items-center gap-3 w-full py-3 text-left transition-opacity active:opacity-70"
            >
              <Avatar nome={c.outroNome} cor={c.outroCor} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {c.outroNome}
                  </p>
                  {c.ultimaMensagemEm && (
                    <span
                      className="text-[11px] shrink-0"
                      style={{
                        color:
                          c.naoLidas > 0 ? "var(--accent)" : "var(--text-2)",
                        fontWeight: c.naoLidas > 0 ? 700 : 400,
                      }}
                    >
                      {formatRelativeTime(c.ultimaMensagemEm)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p
                    className="text-xs truncate"
                    style={{
                      color: "var(--text-2)",
                      fontWeight: c.naoLidas > 0 ? 600 : 400,
                    }}
                  >
                    {c.ultimaMensagem || "Nenhuma mensagem ainda"}
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
          ))}
        </div>
      )}
    </div>
  );
}
