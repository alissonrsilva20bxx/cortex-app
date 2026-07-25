"use client";

import { UserRound } from "lucide-react";

/**
 * Avatar único da Rede — iniciais sobre cor sólida, igual ao resto do app
 * nunca depende de foto real (nem o Cofre usa asset externo). Publicação
 * anônima cai no ícone neutro em vez de iniciais.
 */

const SIZES = { sm: 32, md: 40, lg: 56, xl: 88 } as const;

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

interface Props {
  nome: string;
  cor?: string;
  size?: keyof typeof SIZES;
  anonimo?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Avatar({
  nome,
  cor,
  size = "md",
  anonimo,
  onClick,
  className = "",
}: Props) {
  const px = SIZES[size];
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      aria-label={onClick ? nome : undefined}
      className={`flex items-center justify-center rounded-full shrink-0 font-bold ${
        onClick ? "active:opacity-80 transition-opacity" : ""
      } ${className}`}
      style={{
        width: px,
        height: px,
        fontSize: px * 0.4,
        background: anonimo ? "var(--surface-2)" : cor || "var(--accent)",
        color: anonimo ? "var(--text-muted)" : "#fff",
        border: anonimo ? "1px solid var(--border-color)" : "none",
      }}
    >
      {anonimo ? <UserRound size={px * 0.5} /> : initials(nome)}
    </Tag>
  );
}
