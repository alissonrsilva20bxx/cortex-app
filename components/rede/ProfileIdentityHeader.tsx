"use client";

import { Avatar } from "./Avatar";

interface Stat {
  value: number;
  label: string;
}

interface Props {
  nome: string;
  bio: string;
  cor?: string;
  fotoUrl?: string | null;
  /** Só perfis com identificador público (@handle) o exibem -- terceiros,
   * até agora. Não faz parte da hierarquia do contrato (§"Meu perfil"),
   * é uma preservação do que `PerfilPublicoScreen` já mostrava antes. */
  handle?: string;
  /** Omitido em `PerfilPublicoScreen` (#140) -- o contrato de paridade só
   * exige números explicitamente pro próprio perfil (§"Meu perfil",
   * ponto 1); revalidado contra o protótipo congelado ao planejar #140,
   * sem tela de referência que exija o contrário. */
  stats?: Stat[];
  /** Só `MeuEspacoScreen` usa -- nunca em avatar de outra pessoa (ver
   * aviso em `Avatar.tsx`). */
  avatarEditable?: boolean;
  onEditAvatar?: () => void;
}

/**
 * Bloco de identidade do perfil -- avatar, números opcionais, nome, handle
 * opcional e bio. Passos 1–2 da hierarquia do contrato de paridade
 * (§"Meu perfil"): "avatar e números derivados de dados existentes" +
 * "nome e bio". Compartilhado entre `MeuEspacoScreen` (ticket #139, com
 * estatísticas e avatar editável) e `PerfilPublicoScreen` (ticket #140,
 * sem estatísticas, avatar não editável) -- mesma composição visual,
 * sem duplicar marcação.
 */
export function ProfileIdentityHeader({
  nome,
  bio,
  cor,
  fotoUrl,
  handle,
  stats,
  avatarEditable,
  onEditAvatar,
}: Props) {
  return (
    <div className="flex flex-col items-center text-center mb-4">
      <Avatar
        nome={nome}
        cor={cor}
        fotoUrl={fotoUrl}
        size="xl"
        onClick={avatarEditable ? onEditAvatar : undefined}
        editable={avatarEditable}
      />

      {stats && stats.length > 0 && (
        <div className="flex items-center gap-6 mt-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p
                className="font-bold tabular-nums"
                style={{ fontSize: "16px", color: "var(--text)" }}
              >
                {stat.value}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <p
        className="font-bold mt-3"
        style={{ fontSize: "18px", color: "var(--text)" }}
      >
        {nome}
      </p>
      {handle && (
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {handle}
        </p>
      )}
      {bio && (
        <p
          className="text-sm mt-1 max-w-[280px]"
          style={{ color: "var(--text-muted)" }}
        >
          {bio}
        </p>
      )}
    </div>
  );
}
