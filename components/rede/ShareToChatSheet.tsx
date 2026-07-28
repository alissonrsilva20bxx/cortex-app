"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "./Avatar";
import { findUser, type Conversation } from "@/lib/mockRede";

interface Props {
  open: boolean;
  conversations: Conversation[];
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
}

/** Picker de conversa pra "enviar publicação" — sheet enxuta, reaproveita Avatar. */
export function ShareToChatSheet({
  open,
  conversations,
  onClose,
  onSelectConversation,
}: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Enviar para">
      <div className="px-5 py-3 pb-6 space-y-1">
        {conversations.length === 0 ? (
          <p
            className="text-sm text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            Você ainda não tem conversas.
          </p>
        ) : (
          conversations.map((c) => {
            const user = findUser(c.userId);
            if (!user) return null;
            return (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className="flex items-center gap-3 w-full py-2.5 text-left transition-opacity active:opacity-70"
              >
                <Avatar nome={user.nome} cor={user.cor} size="md" />
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--text)" }}
                >
                  {user.nome}
                </span>
              </button>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}
