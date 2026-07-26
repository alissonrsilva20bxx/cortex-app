"use client";

import { Share2, ChevronRight, Users2 } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LiveLinksEditor } from "./LiveLinksSection";
import { WishlistCard } from "./WishlistCard";
import { PostCard } from "./PostCard";
import {
  MY_BIO,
  type LiveLink,
  type Privacidade,
  type RedePost,
  type WishlistItem,
} from "@/lib/mockRede";
import type { Usuario } from "@/lib/types";

interface Props {
  usuario: Usuario;
  meusPosts: RedePost[];
  liveLinks: LiveLink[];
  wishlistItems: WishlistItem[];
  clientesCount: number;
  defaultPrivacidade: Privacidade;
  onBack: () => void;
  onToggleLiveLink: (id: string) => void;
  onMoveLiveLink: (id: string, direction: "up" | "down") => void;
  onShareProfile: () => void;
  onOpenWishlist: () => void;
  onOpenClientes: () => void;
  onOpenPerfilPublico: () => void;
  onChangeDefaultPrivacidade: (p: Privacidade) => void;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onComment: (post: RedePost) => void;
  onShare: (post: RedePost) => void;
  onOpenMenu: (post: RedePost) => void;
}

export function MeuEspacoScreen({
  usuario,
  meusPosts,
  liveLinks,
  wishlistItems,
  clientesCount,
  defaultPrivacidade,
  onBack,
  onToggleLiveLink,
  onMoveLiveLink,
  onShareProfile,
  onOpenWishlist,
  onOpenClientes,
  onOpenPerfilPublico,
  onChangeDefaultPrivacidade,
  onToggleLike,
  onToggleSave,
  onComment,
  onShare,
  onOpenMenu,
}: Props) {
  return (
    <div className="pb-4">
      <ScreenHeader title="Meu espaço" onBack={onBack} />

      {/* Identidade */}
      <div className="flex flex-col items-center text-center mb-5">
        <Avatar nome={usuario.nome} size="xl" />
        <p
          className="font-bold mt-3"
          style={{ fontSize: "18px", color: "var(--text)" }}
        >
          {usuario.nome}
        </p>
        <p
          className="text-sm mt-1 max-w-[280px]"
          style={{ color: "var(--text-muted)" }}
        >
          {MY_BIO}
        </p>
        <button
          onClick={onOpenPerfilPublico}
          className="flex items-center gap-1.5 mt-3 px-4 py-2 rounded-full text-xs font-semibold transition-opacity active:opacity-70"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
            color: "var(--text)",
          }}
        >
          Ver como perfil público
          <ChevronRight size={13} />
        </button>
      </div>

      {/* LiveLinks */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">LiveLinks</p>
          <button
            onClick={onShareProfile}
            className="flex items-center gap-1.5 text-xs font-semibold active:opacity-70"
            style={{ color: "var(--accent)" }}
          >
            <Share2 size={13} />
            Compartilhar perfil
          </button>
        </div>
        <LiveLinksEditor
          links={liveLinks}
          onToggle={onToggleLiveLink}
          onMove={onMoveLiveLink}
        />
      </section>

      {/* Desejos */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Desejos</p>
          <button
            onClick={onOpenWishlist}
            className="text-xs font-semibold active:opacity-70"
            style={{ color: "var(--accent)" }}
          >
            Ver todos
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          {wishlistItems.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              compact
              onClick={onOpenWishlist}
            />
          ))}
        </div>
      </section>

      {/* Clientes */}
      <section className="mb-6">
        <p className="section-label mb-3">Clientes</p>
        <GlassCard
          radius="md"
          onClick={onOpenClientes}
          className="flex items-center gap-3.5 px-4 py-4"
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <Users2 size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div className="text-left flex-1">
            <p
              className="font-semibold text-sm"
              style={{ color: "var(--text)" }}
            >
              {clientesCount} clientes
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Área privada — não aparece no Feed
            </p>
          </div>
          <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
        </GlassCard>
      </section>

      {/* Minhas publicações */}
      <section className="mb-6">
        <p className="section-label mb-3">Minhas publicações</p>
        {meusPosts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Você ainda não publicou nada.
          </p>
        ) : (
          <div className="space-y-3">
            {meusPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                usuarioNome={usuario.nome}
                onToggleLike={onToggleLike}
                onToggleSave={onToggleSave}
                onComment={onComment}
                onShare={onShare}
                onOpenMenu={onOpenMenu}
                onOpenAutor={() => {}}
              />
            ))}
          </div>
        )}
      </section>

      {/* Privacidade */}
      <section>
        <p className="section-label mb-3">Privacidade</p>
        <GlassCard radius="md" className="p-4">
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Quem vê suas novas publicações por padrão
          </p>
          <SegmentedControl<Privacidade>
            size="sm"
            fullWidth
            value={defaultPrivacidade}
            onChange={onChangeDefaultPrivacidade}
            options={[
              { id: "privado", label: "Privado" },
              { id: "amigas", label: "Amigas" },
              { id: "comunidade", label: "Comunidade" },
            ]}
          />
        </GlassCard>
      </section>
    </div>
  );
}
