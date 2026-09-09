"use client";

import { Heart, MessageCircle, Share2, MoreHorizontal } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/mockRede";
import { CATEGORIA_META, type FeedPost } from "@/lib/rede/feed";

interface Props {
  post: FeedPost;
  onToggleLike: (id: string) => void;
  onComment: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onOpenMenu: (post: FeedPost) => void;
  onOpenAutor: (autorId: string) => void;
}

function ActionButton({
  icon,
  count,
  active,
  activeColor,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  activeColor?: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center gap-1.5 pr-2 transition-opacity active:opacity-60"
      style={{
        paddingTop: 13,
        paddingBottom: 13,
        marginTop: -13,
        marginBottom: -13,
        color: active ? activeColor : "var(--text-muted)",
      }}
    >
      {icon}
      {count !== undefined && (
        <span className="text-xs font-semibold tabular-nums">{count}</span>
      )}
    </button>
  );
}

export function PostCard({
  post,
  onToggleLike,
  onComment,
  onShare,
  onOpenMenu,
  onOpenAutor,
}: Props) {
  const cat = CATEGORIA_META[post.categoria];

  return (
    <GlassCard radius="lg" className="p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar
          nome={post.autorNome}
          cor={post.autorCor}
          fotoUrl={post.autorFotoUrl}
          size="md"
          onClick={() => onOpenAutor(post.autorId)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="font-semibold text-sm truncate"
              style={{ color: "var(--text)" }}
            >
              {post.autorNome}
            </p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: `rgb(${cat.rgb} / 0.12)`,
                color: `rgb(${cat.rgb})`,
                border: `1px solid rgb(${cat.rgb} / 0.25)`,
              }}
            >
              {cat.label}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {formatRelativeTime(post.criadoEm)}
          </p>
        </div>
        <button
          onClick={() => onOpenMenu(post)}
          aria-label="Mais opções"
          className="flex items-center justify-center shrink-0 active:opacity-60"
          style={{ width: 44, height: 44, margin: -13 }}
        >
          <MoreHorizontal size={18} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* Texto */}
      <p
        className="text-sm leading-relaxed mt-3"
        style={{ color: "var(--text-2)" }}
      >
        {post.texto}
      </p>

      {/* Fotos (0-2, migration 0028) -- abrir = nova aba com a imagem em
          tamanho real, mesmo padrão do "abrir arquivo" do Cofre
          (CofreTab.tsx openFile), não um lightbox novo só pra isso. */}
      {post.fotos.length > 0 && (
        <div
          className={`grid gap-1.5 mt-3 rounded-xl overflow-hidden ${
            post.fotos.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {post.fotos.map((foto) => (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada de Storage, não um asset local
            <img
              key={foto.ordem}
              src={foto.url}
              alt={`Foto ${foto.ordem} da publicação de ${post.autorNome}`}
              onClick={() => window.open(foto.url, "_blank")}
              className="w-full object-cover cursor-pointer active:opacity-80 transition-opacity"
              style={{
                aspectRatio: post.fotos.length === 1 ? "16/10" : "1/1",
              }}
            />
          ))}
        </div>
      )}

      {/* Ações */}
      <div
        className="flex items-center justify-between mt-3 pt-3"
        style={{ borderTop: "1px solid var(--divider)" }}
      >
        <div className="flex items-center gap-1">
          <ActionButton
            icon={
              <Heart
                size={18}
                fill={post.curtidoPorMim ? "var(--danger)" : "none"}
              />
            }
            count={post.curtidas}
            active={post.curtidoPorMim}
            activeColor="var(--danger)"
            onClick={() => onToggleLike(post.id)}
            label="Curtir"
          />
          <ActionButton
            icon={<MessageCircle size={18} />}
            count={post.comentariosCount}
            onClick={() => onComment(post)}
            label="Comentar"
          />
          <ActionButton
            icon={<Share2 size={18} />}
            onClick={() => onShare(post)}
            label="Compartilhar"
          />
        </div>
      </div>
    </GlassCard>
  );
}
