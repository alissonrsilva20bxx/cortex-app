"use client";

import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { findUser, type Conversation } from "@/lib/mockRede";

interface Props {
  conversations: Conversation[];
  onBack: () => void;
  onOpenThread: (conversationId: string) => void;
}

export function ChatListScreen({ conversations, onBack, onOpenThread }: Props) {
  return (
    <div className="pb-4">
      <ScreenHeader title="Conversas" onBack={onBack} />

      {conversations.length === 0 ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--text-muted)" }}
        >
          Nenhuma conversa ainda.
        </p>
      ) : (
        <div className="space-y-1">
          {conversations.map((c) => {
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
                          c.naoLidas > 0
                            ? "var(--accent)"
                            : "var(--text-muted)",
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
                        color:
                          c.naoLidas > 0
                            ? "var(--text-2)"
                            : "var(--text-muted)",
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
