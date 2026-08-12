"use client";

import { useState } from "react";
import {
  MessageCircle,
  Check,
  X,
  UserPlus,
  MoreHorizontal,
  UserMinus,
  Ban,
} from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ScreenHeader } from "./ScreenHeader";
import { FriendCard } from "./FriendCard";
import { SkeletonList } from "./Skeleton";
import { OptionsSheet } from "./OptionsSheet";
import type { PessoaResumo } from "@/lib/rede/perfis";
import type { SolicitacaoAmizade } from "@/lib/rede/social";

type SubTab = "amigas" | "solicitacoes" | "descobrir";

function ChipButton({
  onClick,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "#fff" },
    ghost: {
      background: "var(--surface)",
      color: "var(--text-muted)",
      border: "1px solid var(--border-color)",
    },
    danger: {
      background: "rgb(var(--danger-rgb) / 0.1)",
      color: "var(--danger)",
      border: "1px solid rgb(var(--danger-rgb) / 0.25)",
    },
  };
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-full font-semibold transition-opacity active:opacity-70"
      style={{ height: 44, width: 44, ...styles[variant] }}
    >
      {children}
    </button>
  );
}

interface Props {
  loading: boolean;
  friends: PessoaResumo[];
  requests: SolicitacaoAmizade[];
  sugestoes: PessoaResumo[];
  sentRequests: string[];
  onBack: () => void;
  onAccept: (request: SolicitacaoAmizade) => void;
  onDecline: (requestId: string) => void;
  onSendRequest: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onBlock: (userId: string) => void;
  onOpenChat: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
}

export function AmigasScreen({
  loading,
  friends,
  requests,
  sugestoes,
  sentRequests,
  onBack,
  onAccept,
  onDecline,
  onSendRequest,
  onRemoveFriend,
  onBlock,
  onOpenChat,
  onOpenProfile,
}: Props) {
  const [tab, setTab] = useState<SubTab>("amigas");
  const [menuUser, setMenuUser] = useState<PessoaResumo | null>(null);

  return (
    <div className="pb-4">
      <ScreenHeader title="Amigas" onBack={onBack} />

      <SegmentedControl<SubTab>
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { id: "amigas", label: "Minhas amigas" },
          {
            id: "solicitacoes",
            label: `Solicitações${requests.length ? ` (${requests.length})` : ""}`,
          },
          { id: "descobrir", label: "Descobrir" },
        ]}
      />

      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        <>
          {tab === "amigas" && (
            <div className="space-y-2">
              {friends.length === 0 ? (
                <p
                  className="text-sm text-center py-12"
                  style={{ color: "var(--text-muted)" }}
                >
                  Você ainda não tem amigas por aqui.
                </p>
              ) : (
                friends.map((user) => (
                  <FriendCard
                    key={user.id}
                    user={user}
                    onOpenProfile={() => onOpenProfile(user.id)}
                    action={
                      <>
                        <ChipButton onClick={() => onOpenChat(user.id)}>
                          <MessageCircle size={15} />
                        </ChipButton>
                        <ChipButton
                          variant="ghost"
                          onClick={() => setMenuUser(user)}
                        >
                          <MoreHorizontal size={15} />
                        </ChipButton>
                      </>
                    }
                  />
                ))
              )}
            </div>
          )}

          {tab === "solicitacoes" && (
            <div className="space-y-2">
              {requests.length === 0 ? (
                <p
                  className="text-sm text-center py-12"
                  style={{ color: "var(--text-muted)" }}
                >
                  Nenhuma solicitação pendente.
                </p>
              ) : (
                requests.map((req) => (
                  <FriendCard
                    key={req.id}
                    user={req.pessoa}
                    onOpenProfile={() => onOpenProfile(req.pessoa.id)}
                    action={
                      <>
                        <ChipButton
                          variant="danger"
                          onClick={() => onDecline(req.id)}
                        >
                          <X size={15} />
                        </ChipButton>
                        <ChipButton onClick={() => onAccept(req)}>
                          <Check size={15} />
                        </ChipButton>
                      </>
                    }
                  />
                ))
              )}
            </div>
          )}

          {tab === "descobrir" && (
            <div className="space-y-2">
              {sugestoes.length === 0 ? (
                <p
                  className="text-sm text-center py-12"
                  style={{ color: "var(--text-muted)" }}
                >
                  Nenhuma sugestão por enquanto.
                </p>
              ) : (
                sugestoes.map((user) => {
                  const sent = sentRequests.includes(user.id);
                  return (
                    <FriendCard
                      key={user.id}
                      user={user}
                      onOpenProfile={() => onOpenProfile(user.id)}
                      action={
                        sent ? (
                          <span
                            className="text-[11px] font-semibold px-2.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Enviado
                          </span>
                        ) : (
                          <ChipButton onClick={() => onSendRequest(user.id)}>
                            <UserPlus size={15} />
                          </ChipButton>
                        )
                      }
                    />
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      <OptionsSheet
        open={!!menuUser}
        title={menuUser?.nome ?? ""}
        onClose={() => setMenuUser(null)}
        options={[
          {
            key: "remover",
            label: "Remover amiga",
            Icon: UserMinus,
            danger: true,
            onSelect: () => {
              if (menuUser) onRemoveFriend(menuUser.id);
            },
          },
          {
            key: "bloquear",
            label: "Bloquear",
            Icon: Ban,
            danger: true,
            onSelect: () => {
              if (menuUser) onBlock(menuUser.id);
            },
          },
        ]}
      />
    </div>
  );
}
