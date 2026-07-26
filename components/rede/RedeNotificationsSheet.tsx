"use client";

import { Heart, MessageSquare, UserPlus, AtSign } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "./Avatar";
import {
  findUser,
  formatRelativeTime,
  type RedeNotificacao,
} from "@/lib/mockRede";

const ICONS = {
  curtida: Heart,
  comentario: MessageSquare,
  solicitacao: UserPlus,
  mencao: AtSign,
} as const;

interface Props {
  open: boolean;
  onClose: () => void;
  notificacoes: RedeNotificacao[];
  onOpenProfile: (userId: string) => void;
}

export function RedeNotificationsSheet({
  open,
  onClose,
  notificacoes,
  onOpenProfile,
}: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Notificações">
      <div className="overflow-y-auto" style={{ maxHeight: "70dvh" }}>
        {notificacoes.length === 0 ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhuma notificação por aqui ainda.
          </p>
        ) : (
          <div className="px-5 py-3 space-y-1">
            {notificacoes.map((n) => {
              const user = findUser(n.userId);
              const Icon = ICONS[n.tipo];
              if (!user) return null;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    onOpenProfile(n.userId);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full py-2.5 text-left transition-opacity active:opacity-70"
                >
                  <div className="relative shrink-0">
                    <Avatar nome={user.nome} cor={user.cor} size="md" />
                    <div
                      className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full"
                      style={{
                        width: 18,
                        height: 18,
                        background: "var(--surface-2)",
                        border: "2px solid var(--surface-2)",
                        boxShadow: "0 0 0 2px var(--bg)",
                      }}
                    >
                      <Icon size={10} style={{ color: "var(--accent)" }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: "var(--text)" }}>
                      <span className="font-semibold">{user.nome}</span>{" "}
                      <span style={{ color: "var(--text-2)" }}>{n.texto}</span>
                    </p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatRelativeTime(n.criadoEm)}
                    </p>
                  </div>
                  {!n.lida && (
                    <div
                      className="rounded-full shrink-0"
                      style={{
                        width: 8,
                        height: 8,
                        background: "var(--accent)",
                        boxShadow: "var(--glow-sm)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
