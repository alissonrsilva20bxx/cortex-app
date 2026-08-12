"use client";

import { useMemo, useState } from "react";
import { Search, WifiOff } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { SkeletonList } from "./Skeleton";
import { formatRelativeTime } from "@/lib/mockRede";
import type { ConversaResumo } from "@/lib/rede/mensagens";

interface Props {
  loading: boolean;
  conversations: ConversaResumo[];
  /** Falha persistente ao carregar a lista -- distinta de "sem conversa
   * nenhuma ainda" (achado P1 #6 da auditoria de T9). */
  error?: boolean;
  /** `navigator.onLine` -- a lista já carregada continua navegável
   * (é só leitura), mas avisa que pode estar desatualizada. */
  offline?: boolean;
  onBack: () => void;
  onOpenThread: (conversationId: string) => void;
  onRetryLoad?: () => void;
}

export function ChatListScreen({
  loading,
  conversations,
  error = false,
  offline = false,
  onBack,
  onOpenThread,
  onRetryLoad,
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

      {offline && (
        <div
          className="flex items-center gap-2 px-3.5 py-2.5 mb-4 text-xs font-medium"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            color: "var(--text-2)",
          }}
        >
          <WifiOff size={14} style={{ color: "var(--text-muted)" }} />
          Você está offline. Mostrando conversas já carregadas.
        </div>
      )}

      {!loading && !error && conversations.length > 0 && (
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
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            Não foi possível carregar suas conversas.
          </p>
          {onRetryLoad && (
            <button
              onClick={onRetryLoad}
              className="text-sm font-semibold mt-2 active:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              Tentar novamente
            </button>
          )}
        </div>
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
