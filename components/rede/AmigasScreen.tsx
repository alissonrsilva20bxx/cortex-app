"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  Check,
  X,
  UserPlus,
  MoreHorizontal,
  UserMinus,
} from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ScreenHeader } from "./ScreenHeader";
import { FriendCard } from "./FriendCard";
import { SkeletonList } from "./Skeleton";
import { OptionsSheet } from "./OptionsSheet";
import {
  findUser,
  type FriendRequest,
  type DiscoverPerson,
} from "@/lib/mockRede";

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
      style={{ height: 34, width: 34, ...styles[variant] }}
    >
      {children}
    </button>
  );
}

interface Props {
  friends: string[];
  requests: FriendRequest[];
  sentRequests: string[];
  onBack: () => void;
  onAccept: (request: FriendRequest) => void;
  onDecline: (requestId: string) => void;
  onSendRequest: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onOpenChat: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  discoverPeople: DiscoverPerson[];
}

export function AmigasScreen({
  friends,
  requests,
  sentRequests,
  onBack,
  onAccept,
  onDecline,
  onSendRequest,
  onRemoveFriend,
  onOpenChat,
  onOpenProfile,
  discoverPeople,
}: Props) {
  const [tab, setTab] = useState<SubTab>("amigas");
  const [loading, setLoading] = useState(true);
  const [menuUserId, setMenuUserId] = useState<string | null>(null);

  // Simula o instante de carregamento inicial da tela (dados locais são
  // instantâneos, mas o escopo pede o estado de carregando visível).
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 420);
    return () => clearTimeout(t);
  }, []);

  const menuUser = menuUserId ? findUser(menuUserId) : null;

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
                friends.map((id) => {
                  const user = findUser(id);
                  if (!user) return null;
                  return (
                    <FriendCard
                      key={id}
                      user={user}
                      onOpenProfile={() => onOpenProfile(id)}
                      action={
                        <>
                          <ChipButton onClick={() => onOpenChat(id)}>
                            <MessageCircle size={15} />
                          </ChipButton>
                          <ChipButton
                            variant="ghost"
                            onClick={() => setMenuUserId(id)}
                          >
                            <MoreHorizontal size={15} />
                          </ChipButton>
                        </>
                      }
                    />
                  );
                })
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
                requests.map((req) => {
                  const user = findUser(req.userId);
                  if (!user) return null;
                  return (
                    <FriendCard
                      key={req.id}
                      user={user}
                      subtitle={`${req.mutualCount} amiga${req.mutualCount !== 1 ? "s" : ""} em comum`}
                      onOpenProfile={() => onOpenProfile(req.userId)}
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
                  );
                })
              )}
            </div>
          )}

          {tab === "descobrir" && (
            <div className="space-y-2">
              {discoverPeople.length === 0 ? (
                <p
                  className="text-sm text-center py-12"
                  style={{ color: "var(--text-muted)" }}
                >
                  Nenhuma sugestão por enquanto.
                </p>
              ) : (
                discoverPeople.map((d) => {
                  const user = findUser(d.userId);
                  if (!user) return null;
                  const sent = sentRequests.includes(d.userId);
                  return (
                    <FriendCard
                      key={d.userId}
                      user={user}
                      subtitle={d.motivo}
                      onOpenProfile={() => onOpenProfile(d.userId)}
                      action={
                        sent ? (
                          <span
                            className="text-[11px] font-semibold px-2.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Enviado
                          </span>
                        ) : (
                          <ChipButton onClick={() => onSendRequest(d.userId)}>
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
        onClose={() => setMenuUserId(null)}
        options={[
          {
            key: "remover",
            label: "Remover amiga",
            Icon: UserMinus,
            danger: true,
            onSelect: () => {
              if (menuUserId) onRemoveFriend(menuUserId);
            },
          },
        ]}
      />
    </div>
  );
}
