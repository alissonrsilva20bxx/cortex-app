"use client";

import { Image as ImageIcon } from "lucide-react";
import type { CSSProperties } from "react";

/**
 * Bloco de imagem mockada — gradiente sólido + ícone, nunca uma URL externa
 * (mesma lógica do Cofre/Avatar: o app funciona offline, sem depender de
 * assets de terceiros). Usado onde a Rede promete uma foto real.
 */

interface Props {
  cor: string;
  height?: number | string;
  radius?: string;
  className?: string;
}

export function MockImage({
  cor,
  height = 220,
  radius,
  className = "",
}: Props) {
  const style: CSSProperties = {
    height,
    borderRadius: radius ?? "var(--radius-md)",
    background: `linear-gradient(155deg, ${cor}55 0%, ${cor}22 100%)`,
    border: `1px solid ${cor}40`,
  };
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={style}
    >
      <ImageIcon size={28} color={cor} strokeWidth={1.5} />
    </div>
  );
}
