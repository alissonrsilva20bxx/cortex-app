"use client";

import {
  Link2,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Trash2,
  Plus,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/database.types";

export type LiveLink = Database["public"]["Tables"]["rede_livelinks"]["Row"];

export const LIVELINKS_MAX = 5;

/** Lista editável — usada em Meu espaço (adicionar, editar, excluir,
 * reordenar). Lista livre estilo Linktree: sem catálogo fixo de
 * plataforma nem toggle ativo/inativo, esses conceitos não existem no
 * schema real (`rede_livelinks`: id, titulo, url, ordem). */
interface EditorProps {
  links: LiveLink[];
  onMove: (id: string, direction: "up" | "down") => void;
  onEdit: (link: LiveLink) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function LiveLinksEditor({
  links,
  onMove,
  onEdit,
  onDelete,
  onAdd,
}: EditorProps) {
  const sorted = [...links].sort((a, b) => a.ordem - b.ordem);
  return (
    <div className="space-y-2">
      {sorted.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Nenhum LiveLink ainda.
        </p>
      )}
      {sorted.map((link, i) => (
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
            <Link2 size={16} style={{ color: "var(--accent)" }} />
          </div>
          <button
            onClick={() => onEdit(link)}
            className="min-w-0 flex-1 text-left active:opacity-70 transition-opacity"
            aria-label={`Editar ${link.titulo}`}
          >
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text)" }}
            >
              {link.titulo}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {link.url}
            </p>
          </button>
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
            <button
              onClick={() => onDelete(link.id)}
              aria-label={`Excluir ${link.titulo}`}
              className="p-1 active:opacity-60"
            >
              <Trash2 size={15} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        </GlassCard>
      ))}
      {sorted.length < LIVELINKS_MAX && (
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold transition-opacity active:opacity-70"
          style={{
            border: "1px dashed var(--border-color)",
            color: "var(--accent)",
          }}
        >
          <Plus size={15} />
          Adicionar LiveLink
        </button>
      )}
    </div>
  );
}

/** Preview público — como quem visita o perfil vê, com links clicáveis de
 * verdade. */
export function LiveLinksPreview({ links }: { links: LiveLink[] }) {
  const sorted = [...links].sort((a, b) => a.ordem - b.ordem);

  if (sorted.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Nenhum LiveLink ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-card flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-80 transition-opacity"
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 34,
              height: 34,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <Link2 size={15} style={{ color: "var(--accent)" }} />
          </div>
          <span
            className="flex-1 text-sm font-semibold truncate"
            style={{ color: "var(--text)" }}
          >
            {link.titulo}
          </span>
          <ExternalLink size={13} style={{ color: "var(--text-muted)" }} />
        </a>
      ))}
    </div>
  );
}
