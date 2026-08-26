"use client";

import {
  Heart,
  MessageSquare,
  UserPlus,
  MessageCircle,
  CheckCheck,
  WifiOff,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "./Avatar";
import { SkeletonRow } from "./Skeleton";
import { formatRelativeTime } from "@/lib/mockRede";
import type { Notificacao } from "@/lib/rede/notificacoes";

const ICONS = {
  curtida: Heart,
  comentario: MessageSquare,
  solicitacao: UserPlus,
  mensagem: MessageCircle,
} as const;

interface Props {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  /** Falha persistente ao carregar -- distinta de "sem notificação
   * nenhuma ainda" (achado P1 #6 da auditoria de T9). */
  error?: boolean;
  /** `navigator.onLine` -- "marcar todas como lidas" escreve no cursor
   * real (upsert), não faz sentido oferecer offline. */
  offline?: boolean;
  notificacoes: Notificacao[];
  onOpenNotificacao: (n: Notificacao) => void;
  onMarkAllRead: () => void;
  onRetryLoad?: () => void;
}

export function RedeNotificationsSheet({
  open,
  onClose,
  loading,
  error = false,
  offline = false,
  notificacoes,
  onOpenNotificacao,
  onMarkAllRead,
  onRetryLoad,
}: Props) {
  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Notificações"
      largeCloseTarget
    >
      <div className="overflow-y-auto" style={{ maxHeight: "70dvh" }}>
        {offline && (
          <div
            className="flex items-center gap-2 mx-5 mt-3 px-3.5 py-2.5 text-xs font-medium"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-lg)",
              color: "var(--text-2)",
            }}
          >
            <WifiOff size={14} style={{ color: "var(--text-muted)" }} />
            Você está offline.
          </div>
        )}

        {!loading && !error && unreadCount > 0 && (
          <div className="flex justify-end px-5 pt-3">
            <button
              onClick={onMarkAllRead}
              disabled={offline}
              className="flex items-center justify-end gap-1.5 text-xs font-semibold active:opacity-70 disabled:opacity-40"
              style={{ color: "var(--accent)", minHeight: 44 }}
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
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              Não foi possível carregar suas notificações.
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
              const Icon = ICONS[n.tipo];
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    onOpenNotificacao(n);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full py-2.5 px-2 -mx-2 rounded-xl text-left transition-opacity active:opacity-70"
                  style={{
                    background: n.lida
                      ? "transparent"
                      : "rgb(var(--accent-rgb) / 0.06)",
                  }}
                >
                  <div className="relative shrink-0">
                    <Avatar
                      nome={n.pessoa.nome}
                      cor={n.pessoa.cor}
                      fotoUrl={n.pessoa.fotoUrl}
                      size="md"
                    />
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
                      <span className="font-semibold">{n.pessoa.nome} </span>
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
