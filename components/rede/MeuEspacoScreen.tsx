"use client";

import { Share2, ChevronRight, Users2, Pencil, ShieldOff } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LiveLinksEditor, type LiveLink } from "./LiveLinksSection";
import { WishlistCard } from "./WishlistCard";
import { PostCard } from "./PostCard";
import { SkeletonProfileHeader, SkeletonList, SkeletonGrid } from "./Skeleton";
import { type Privacidade, type WishlistItem } from "@/lib/mockRede";
import type { FeedPost } from "@/lib/rede/feed";

interface Props {
  nomeExibicao: string;
  bio: string;
  cor: string;
  meusPosts: FeedPost[];
  liveLinks: LiveLink[];
  wishlistItems: WishlistItem[];
  clientesCount: number;
  defaultPrivacidade: Privacidade;
  /** Carregamento real do próprio perfil (RedeTab) -- não um timeout fixo. */
  loading: boolean;
  /** Falha real ao carregar o próprio perfil -- estado persistente. */
  error: boolean;
  onBack: () => void;
  onMoveLiveLink: (id: string, direction: "up" | "down") => void;
  onEditLiveLink: (link: LiveLink) => void;
  onDeleteLiveLink: (id: string) => void;
  onAddLiveLink: () => void;
  onEditProfile: () => void;
  onShareProfile: () => void;
  onOpenWishlist: () => void;
  onOpenClientes: () => void;
  onOpenBloqueados: () => void;
  onOpenPerfilPublico: () => void;
  onChangeDefaultPrivacidade: (p: Privacidade) => void;
  onToggleLike: (id: string) => void;
  onComment: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onOpenMenu: (post: FeedPost) => void;
}

export function MeuEspacoScreen({
  nomeExibicao,
  bio,
  cor,
  meusPosts,
  liveLinks,
  wishlistItems,
  clientesCount,
  defaultPrivacidade,
  loading,
  error,
  onBack,
  onMoveLiveLink,
  onEditLiveLink,
  onDeleteLiveLink,
  onAddLiveLink,
  onEditProfile,
  onShareProfile,
  onOpenWishlist,
  onOpenClientes,
  onOpenBloqueados,
  onOpenPerfilPublico,
  onChangeDefaultPrivacidade,
  onToggleLike,
  onComment,
  onShare,
  onOpenMenu,
}: Props) {
  return (
    <div className="pb-4">
      <ScreenHeader title="Meu espaço" onBack={onBack} />

      {loading ? (
        <>
          <SkeletonProfileHeader />
          <div className="space-y-6">
            <SkeletonList rows={3} />
            <SkeletonGrid items={2} />
            <SkeletonList rows={1} />
          </div>
        </>
      ) : error ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--danger)" }}
        >
          Não foi possível carregar seu espaço. Tente novamente mais tarde.
        </p>
      ) : (
        <>
          {/* Identidade */}
          <div className="flex flex-col items-center text-center mb-5">
            <Avatar nome={nomeExibicao} cor={cor} size="xl" />
            <div className="flex items-center gap-1.5 mt-3">
              <p
                className="font-bold"
                style={{ fontSize: "18px", color: "var(--text)" }}
              >
                {nomeExibicao}
              </p>
              <button
                onClick={onEditProfile}
                aria-label="Editar perfil"
                className="flex items-center justify-center active:opacity-60"
                style={{ width: 44, height: 44, margin: "-15px" }}
              >
                <Pencil size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            {bio && (
              <p
                className="text-sm mt-1 max-w-[280px]"
                style={{ color: "var(--text-muted)" }}
              >
                {bio}
              </p>
            )}
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
              onMove={onMoveLiveLink}
              onEdit={onEditLiveLink}
              onDelete={onDeleteLiveLink}
              onAdd={onAddLiveLink}
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
                    onToggleLike={onToggleLike}
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
              <p
                className="text-xs mb-3"
                style={{ color: "var(--text-muted)" }}
              >
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

          {/* Segurança */}
          <section>
            <p className="section-label mb-3">Segurança</p>
            <GlassCard
              radius="md"
              onClick={onOpenBloqueados}
              className="flex items-center gap-3.5 px-4 py-4"
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgb(var(--danger-rgb) / 0.12)",
                }}
              >
                <ShieldOff size={16} style={{ color: "var(--danger)" }} />
              </div>
              <div className="text-left flex-1">
                <p
                  className="font-semibold text-sm"
                  style={{ color: "var(--text)" }}
                >
                  Pessoas bloqueadas
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Ver e desbloquear
                </p>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
            </GlassCard>
          </section>
        </>
      )}
    </div>
  );
}
