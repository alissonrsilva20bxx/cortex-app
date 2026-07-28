"use client";

import { useEffect, useState } from "react";
import {
  Heart,
  MessageSquare,
  UserPlus,
  AtSign,
  MessageCircle,
  Megaphone,
  CheckCheck,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "./Avatar";
import { SkeletonRow } from "./Skeleton";
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
  mensagem: MessageCircle,
  aviso: Megaphone,
} as const;

interface Props {
  open: boolean;
  onClose: () => void;
  notificacoes: RedeNotificacao[];
  onOpenProfile: (userId: string) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function RedeNotificationsSheet({
  open,
  onClose,
  notificacoes,
  onOpenProfile,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const [loading, setLoading] = useState(true);

  // Simula o instante de carregamento a cada vez que a sheet abre.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, [open]);

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  return (
    <BottomSheet open={open} onClose={onClose} title="Notificações">
      <div className="overflow-y-auto" style={{ maxHeight: "70dvh" }}>
        {!loading && unreadCount > 0 && (
          <div className="flex justify-end px-5 pt-3">
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1.5 text-xs font-semibold active:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              <CheckCheck size={13} />
              Marcar todas como lidas
            </button>
          </div>
        )}

        {loading ? (
          <div className="px-5 py-3 space-y-2">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : notificacoes.length === 0 ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhuma notificação por aqui ainda.
          </p>
        ) : (
          <div className="px-5 py-3 space-y-1">
            {notificacoes.map((n) => {
              const user = n.userId ? findUser(n.userId) : null;
              const Icon = ICONS[n.tipo];
              const isAviso = n.tipo === "aviso";
              if (!isAviso && !user) return null;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    onMarkRead(n.id);
                    if (user) {
                      onOpenProfile(user.id);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-3 w-full py-2.5 px-2 -mx-2 rounded-xl text-left transition-opacity active:opacity-70"
                  style={{
                    background: n.lida
                      ? "transparent"
                      : "rgb(var(--accent-rgb) / 0.06)",
                  }}
                >
                  <div className="relative shrink-0">
                    {user ? (
                      <Avatar nome={user.nome} cor={user.cor} size="md" />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: 40,
                          height: 40,
                          background: "rgb(var(--accent-rgb) / 0.14)",
                        }}
                      >
                        <Megaphone
                          size={17}
                          style={{ color: "var(--accent)" }}
                        />
                      </div>
                    )}
                    {user && (
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
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: "var(--text)" }}>
                      {user && (
                        <span className="font-semibold">{user.nome} </span>
                      )}
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
