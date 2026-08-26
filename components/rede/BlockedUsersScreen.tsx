"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { SkeletonList } from "./Skeleton";
import type { PessoaResumo } from "@/lib/rede/perfis";

/**
 * T8 (issue #35), P0 -- até este ticket, bloquear alguém pelo app não tinha
 * nenhum caminho de volta (`desbloquearUsuario` existia e já era testado,
 * só faltava a UI). Lista só nome/avatar (`rede_listar_bloqueados`, RPC
 * estreita de 0018) -- sem bio, sem LiveLinks, sem mais nada da pessoa
 * bloqueada.
 */

interface Props {
  items: PessoaResumo[];
  loading: boolean;
  error: boolean;
  onBack: () => void;
  onUnblock: (userId: string) => void;
}

export function BlockedUsersScreen({
  items,
  loading,
  error,
  onBack,
  onUnblock,
}: Props) {
  return (
    <div className="pb-4">
      <ScreenHeader title="Pessoas bloqueadas" onBack={onBack} />

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--danger)" }}
        >
          Não foi possível carregar as pessoas bloqueadas. Tente novamente mais
          tarde.
        </p>
      ) : items.length === 0 ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--text-muted)" }}
        >
          Você não bloqueou ninguém ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((pessoa) => (
            <GlassCard
              key={pessoa.id}
              radius="lg"
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <Avatar
                nome={pessoa.nome}
                cor={pessoa.cor}
                fotoUrl={pessoa.fotoUrl}
                size="md"
              />
              <p
                className="flex-1 min-w-0 text-sm font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                {pessoa.nome}
              </p>
              <button
                onClick={() => onUnblock(pessoa.id)}
                className="shrink-0 flex items-center justify-center px-4 rounded-full text-xs font-semibold transition-opacity active:opacity-70"
                style={{
                  height: 44,
                  minWidth: 44,
                  background: "var(--surface)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text)",
                }}
              >
                Desbloquear
              </button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
