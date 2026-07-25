"use client";

import { Lock, Users, Globe } from "lucide-react";
import { MockImage } from "./MockImage";
import { formatBRL } from "@/lib/finance";
import type { Privacidade, WishlistEstado, WishlistItem } from "@/lib/mockRede";

const ESTADO_META: Record<WishlistEstado, { label: string; rgb: string }> = {
  quero: { label: "Quero", rgb: "var(--info-rgb)" },
  planejando: { label: "Planejando", rgb: "var(--warning-rgb)" },
  conquistado: { label: "Conquistado", rgb: "var(--success-rgb)" },
};

const PRIVACIDADE_ICON: Record<Privacidade, typeof Lock> = {
  privado: Lock,
  amigas: Users,
  comunidade: Globe,
};

interface Props {
  item: WishlistItem;
  onClick?: () => void;
  compact?: boolean;
}

export function WishlistCard({ item, onClick, compact }: Props) {
  const pct = Math.min(
    100,
    Math.round((item.valorAtual / item.valorAlvo) * 100)
  );
  const estado = ESTADO_META[item.estado];
  const PrivIcon = PRIVACIDADE_ICON[item.privacidade];
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`glass-card block text-left rounded-2xl p-3 ${onClick ? "transition-all active:opacity-80 active:scale-[0.99]" : ""}`}
      style={compact ? { width: 168, flexShrink: 0 } : undefined}
    >
      <MockImage
        cor={item.cor}
        height={compact ? 88 : 130}
        radius="var(--radius-sm)"
      />
      <div className="flex items-center gap-1.5 mt-2.5">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: `rgb(${estado.rgb} / 0.12)`,
            color: `rgb(${estado.rgb})`,
          }}
        >
          {estado.label}
        </span>
        <PrivIcon size={11} style={{ color: "var(--text-muted)" }} />
      </div>
      <p
        className="text-sm font-semibold mt-1.5 truncate"
        style={{ color: "var(--text)" }}
      >
        {item.nome}
      </p>
      <div className="progress-track mt-2">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p
        className="text-[11px] mt-1.5 font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {formatBRL(item.valorAtual)} de {formatBRL(item.valorAlvo)}
      </p>
    </Tag>
  );
}
