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
