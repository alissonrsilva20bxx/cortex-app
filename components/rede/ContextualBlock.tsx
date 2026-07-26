"use client";

import { ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * Bloco contextual que se mistura ao Feed ("duas solicitações de amizade",
 * "desejo perto da meta"...). Deliberadamente discreto — mesma altura de um
 * post curto, nunca um banner que domina a rolagem.
 */

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function ContextualBlock({ icon, title, subtitle, onClick }: Props) {
  return (
    <GlassCard
      radius="lg"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5"
    >
      <div
        className="flex items-center justify-center rounded-xl shrink-0"
        style={{
          width: 38,
          height: 38,
          background: "rgb(var(--accent-rgb) / 0.12)",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p
          className="font-semibold text-sm truncate"
          style={{ color: "var(--text)" }}
        >
          {title}
        </p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {subtitle}
        </p>
      </div>
      <ChevronRight
        size={16}
        className="shrink-0"
        style={{ color: "var(--text-muted)" }}
      />
    </GlassCard>
  );
}
