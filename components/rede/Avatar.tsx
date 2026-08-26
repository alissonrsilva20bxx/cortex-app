"use client";

import { Camera, UserRound } from "lucide-react";

/**
 * Avatar único da Rede — foto real quando existe (`fotoUrl`), senão iniciais
 * sobre cor sólida. Publicação anônima cai no ícone neutro mesmo se a
 * pessoa tiver foto, e nunca vaza a foto de quem publicou anonimamente.
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
  fotoUrl?: string | null;
  size?: keyof typeof SIZES;
  anonimo?: boolean;
  onClick?: () => void;
  /** Selo de câmera no canto — único sinal visual de que o avatar abre o
   * seletor de foto (sem isso, achado 2026-08-25: usuária não descobre que
   * dá pra tocar no avatar pra trocar a foto). Só usar onde onClick de fato
   * edita a própria foto, nunca em avatares que abrem perfil/post de outra
   * pessoa. */
  editable?: boolean;
  className?: string;
}

export function Avatar({
  nome,
  cor,
  fotoUrl,
  size = "md",
  anonimo,
  onClick,
  editable,
  className = "",
}: Props) {
  // Alvo de toque mínimo de 44px (achado #56) quando interativo — só sm/md
  // crescem, lg/xl já passam de 44.
  const px = onClick ? Math.max(SIZES[size], 44) : SIZES[size];
  const Tag = onClick ? "button" : "div";
  const temFoto = !!fotoUrl && !anonimo;

  const avatar = (
    <Tag
      onClick={onClick}
      aria-label={onClick ? nome : undefined}
      className={`flex items-center justify-center rounded-full shrink-0 font-bold overflow-hidden ${
        onClick ? "active:opacity-80 transition-opacity" : ""
      } ${editable ? "" : className}`}
      style={{
        width: px,
        height: px,
        fontSize: px * 0.4,
        background: temFoto
          ? undefined
          : anonimo
            ? "var(--surface-2)"
            : cor || "var(--accent)",
        color: anonimo ? "var(--text-muted)" : "#fff",
        border: anonimo ? "1px solid var(--border-color)" : "none",
      }}
    >
      {temFoto ? (
        // URL do Storage é dinâmica por usuária, não dá pra listar em next.config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fotoUrl}
          alt={nome}
          width={px}
          height={px}
          className="w-full h-full object-cover"
        />
      ) : anonimo ? (
        <UserRound size={px * 0.5} />
      ) : (
        initials(nome)
      )}
    </Tag>
  );

  if (!editable) return avatar;

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: px, height: px }}
    >
      {avatar}
      <span
        aria-hidden="true"
        className="absolute flex items-center justify-center rounded-full"
        style={{
          width: 28,
          height: 28,
          right: -2,
          bottom: -2,
          background: "var(--accent)",
          border: "2px solid var(--surface-1)",
          color: "#fff",
        }}
      >
        <Camera size={14} />
      </span>
    </span>
  );
}
