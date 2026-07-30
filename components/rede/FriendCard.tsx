"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "./Avatar";
import type { PessoaResumo } from "@/lib/rede/perfis";

interface Props {
  user: PessoaResumo;
  subtitle?: string;
  onOpenProfile: () => void;
  action: React.ReactNode;
}

export function FriendCard({ user, subtitle, onOpenProfile, action }: Props) {
  return (
    <GlassCard radius="lg" className="flex items-center gap-3 px-4 py-3.5">
      <Avatar
        nome={user.nome}
        cor={user.cor}
        size="md"
        onClick={onOpenProfile}
      />
      <button onClick={onOpenProfile} className="flex-1 min-w-0 text-left">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: "var(--text)" }}
        >
          {user.nome}
        </p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {subtitle ?? user.bio}
        </p>
      </button>
      <div className="shrink-0 flex items-center gap-2">{action}</div>
    </GlassCard>
  );
}
