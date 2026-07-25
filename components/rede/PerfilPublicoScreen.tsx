"use client";

import { MessageCircle, UserPlus, Check } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { LiveLinksPreview } from "./LiveLinksSection";
import { WishlistCard } from "./WishlistCard";
import { PostCard } from "./PostCard";
import type { LiveLink, RedePost, WishlistItem } from "@/lib/mockRede";
import type { Usuario } from "@/lib/types";

interface Props {
  nome: string;
  handle?: string;
  cor?: string;
  bio: string;
  isMe: boolean;
  isFriend: boolean;
  requestSent: boolean;
  liveLinks: LiveLink[];
  wishlistPublico: WishlistItem[];
  posts: RedePost[];
  usuario: Usuario;
  onBack: () => void;
  onOpenChat?: () => void;
  onSendRequest?: () => void;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onComment: (post: RedePost) => void;
  onShare: (post: RedePost) => void;
  onOpenMenu: (post: RedePost) => void;
}

export function PerfilPublicoScreen({
  nome,
  handle,
  cor,
  bio,
  isMe,
  isFriend,
  requestSent,
  liveLinks,
  wishlistPublico,
  posts,
  usuario,
  onBack,
  onOpenChat,
  onSendRequest,
  onToggleLike,
  onToggleSave,
  onComment,
  onShare,
  onOpenMenu,
}: Props) {
  return (
    <div className="pb-4">
      <ScreenHeader
        title={isMe ? "Preview público" : "Perfil"}
        onBack={onBack}
      />

      <div className="flex flex-col items-center text-center mb-5">
        <Avatar nome={nome} cor={cor} size="xl" />
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
        <p
          className="text-sm mt-2 max-w-[280px]"
          style={{ color: "var(--text-muted)" }}
        >
          {bio}
        </p>

        {!isMe && (
          <div className="flex items-center gap-2 mt-4">
            {isFriend ? (
              <button
                onClick={onOpenChat}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-opacity active:opacity-70"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <MessageCircle size={13} />
                Conversar
              </button>
            ) : requestSent ? (
              <span
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <Check size={13} />
                Solicitação enviada
              </span>
            ) : (
              <button
                onClick={onSendRequest}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-opacity active:opacity-70"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <UserPlus size={13} />
                Adicionar
              </button>
            )}
          </div>
        )}
        {isMe && (
          <p
            className="text-[11px] mt-4"
            style={{ color: "var(--text-muted)" }}
          >
            É assim que quem não é sua amiga vê seu perfil.
          </p>
        )}
      </div>

      <section className="mb-6">
        <p className="section-label mb-3">LiveLinks</p>
        <LiveLinksPreview links={liveLinks} />
      </section>

      {wishlistPublico.length > 0 && (
        <section className="mb-6">
          <p className="section-label mb-3">Desejos</p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {wishlistPublico.map((item) => (
              <WishlistCard key={item.id} item={item} compact />
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section>
          <p className="section-label mb-3">Publicações</p>
          <div className="space-y-3">
            {posts.map((post) => (
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
        </section>
      )}
    </div>
  );
}
