"use client";

import { GlassCard } from "@/components/ui/GlassCard";

/**
 * Blocos de carregamento da Rede — mesma silhueta das linhas reais
 * (GlassCard + avatar + 2 linhas de texto), pra não "pular" o layout quando
 * os dados mockados terminam de "chegar". Compartilhado entre as telas que
 * simulam um instante de carregamento (Busca, Amigas, Chat, Notificações…).
 */

function Block({
  width,
  height = 10,
  className = "",
}: {
  width: string | number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-full ${className}`}
      style={{ width, height, background: "var(--surface-2)" }}
    />
  );
}

export function SkeletonRow({
  withSubtitle = true,
}: {
  withSubtitle?: boolean;
}) {
  return (
    <GlassCard radius="lg" className="flex items-center gap-3 px-4 py-3.5">
      <Block width={40} height={40} className="!rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Block width="55%" height={12} />
        {withSubtitle && <Block width="35%" height={10} />}
      </div>
    </GlassCard>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Silhueta de um WishlistCard (imagem + 2 linhas) — grade 2 colunas. */
export function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-3">
      <Block
        width="100%"
        height={130}
        className="!rounded-[var(--radius-sm)]"
      />
      <Block width="70%" height={12} className="mt-2.5" />
      <Block width="45%" height={10} className="mt-2" />
    </div>
  );
}

export function SkeletonGrid({ items = 4 }: { items?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: items }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Cabeçalho de perfil — avatar centralizado + nome + bio (Meu espaço, Perfil público). */
export function SkeletonProfileHeader() {
  return (
    <div className="flex flex-col items-center mb-5">
      <Block width={88} height={88} className="!rounded-full" />
      <Block width={140} height={14} className="mt-3" />
      <Block width={200} height={10} className="mt-2.5" />
    </div>
  );
}
