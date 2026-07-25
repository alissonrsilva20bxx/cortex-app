"use client";

import {
  Instagram,
  MessageCircle,
  Music2,
  Globe,
  CalendarCheck,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Switch } from "@/components/ui/Switch";
import type { LiveLink, Plataforma } from "@/lib/mockRede";

const PLATFORM_ICON: Record<Plataforma, typeof Instagram> = {
  instagram: Instagram,
  whatsapp: MessageCircle,
  tiktok: Music2,
  site: Globe,
  agenda: CalendarCheck,
};

/** Lista editável — usada em Meu espaço (ativar, reordenar). */
interface EditorProps {
  links: LiveLink[];
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

export function LiveLinksEditor({ links, onToggle, onMove }: EditorProps) {
  const sorted = [...links].sort((a, b) => a.ordem - b.ordem);
  return (
    <div className="space-y-2">
      {sorted.map((link, i) => {
        const Icon = PLATFORM_ICON[link.plataforma];
        return (
          <GlassCard
            key={link.id}
            radius="md"
            className="flex items-center gap-3 px-3.5 py-3"
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 36,
                height: 36,
                background: "rgb(var(--accent-rgb) / 0.12)",
              }}
            >
              <Icon size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                {link.label}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {link.url}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => onMove(link.id, "up")}
                disabled={i === 0}
                aria-label="Mover para cima"
                className="p-1 active:opacity-60 disabled:opacity-25"
              >
                <ChevronUp size={15} style={{ color: "var(--text-muted)" }} />
              </button>
              <button
                onClick={() => onMove(link.id, "down")}
                disabled={i === sorted.length - 1}
                aria-label="Mover para baixo"
                className="p-1 active:opacity-60 disabled:opacity-25"
              >
                <ChevronDown size={15} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            <Switch
              checked={link.ativo}
              onChange={() => onToggle(link.id)}
              ariaLabel={link.label}
            />
          </GlassCard>
        );
      })}
    </div>
  );
}

/** Preview público — só os links ativos, como quem visita o perfil vê. */
export function LiveLinksPreview({ links }: { links: LiveLink[] }) {
  const active = [...links]
    .filter((l) => l.ativo)
    .sort((a, b) => a.ordem - b.ordem);

  if (active.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Nenhum LiveLink ativo no momento.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {active.map((link) => {
        const Icon = PLATFORM_ICON[link.plataforma];
        return (
          <div
            key={link.id}
            className="glass-card flex items-center gap-3 px-4 py-3 rounded-2xl"
          >
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 34,
                height: 34,
                background: "rgb(var(--accent-rgb) / 0.12)",
              }}
            >
              <Icon size={15} style={{ color: "var(--accent)" }} />
            </div>
            <span
              className="flex-1 text-sm font-semibold truncate"
              style={{ color: "var(--text)" }}
            >
              {link.label}
            </span>
            <ExternalLink size={13} style={{ color: "var(--text-muted)" }} />
          </div>
        );
      })}
    </div>
  );
}
