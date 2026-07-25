"use client";

import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MoreHorizontal,
  Link2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "./Avatar";
import { MockImage } from "./MockImage";
import {
  findUser,
  formatRelativeTime,
  CATEGORIA_META,
  type RedePost,
} from "@/lib/mockRede";

interface Props {
  post: RedePost;
  usuarioNome: string;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onComment: (post: RedePost) => void;
  onShare: (post: RedePost) => void;
  onOpenMenu: (post: RedePost) => void;
  onOpenAutor: (autorId: string) => void;
  onOpenWishlist?: () => void;
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
      className="flex items-center gap-1.5 py-1 pr-2 transition-opacity active:opacity-60"
      style={{ color: active ? activeColor : "var(--text-muted)" }}
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
  usuarioNome,
  onToggleLike,
  onToggleSave,
  onComment,
  onShare,
  onOpenMenu,
  onOpenAutor,
  onOpenWishlist,
}: Props) {
  const autor = post.anonimo ? null : findUser(post.autorId);
  const nomeExibido = post.anonimo
    ? "Anônima"
    : post.autorId === "me"
      ? usuarioNome
      : (autor?.nome ?? "Usuária");
  const cat = CATEGORIA_META[post.categoria];

  return (
    <GlassCard radius="lg" className="p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar
          nome={nomeExibido}
          cor={autor?.cor}
          anonimo={post.anonimo}
          size="md"
          onClick={post.anonimo ? undefined : () => onOpenAutor(post.autorId)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="font-semibold text-sm truncate"
              style={{ color: "var(--text)" }}
            >
              {nomeExibido}
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
          className="p-1 -m-1 shrink-0 active:opacity-60"
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

      {/* Foto mockada */}
      {post.tipo === "foto" && post.imagemCor && (
        <MockImage cor={post.imagemCor} className="mt-3 w-full" />
      )}

      {/* Card de desejo embutido */}
      {post.tipo === "desejo" && post.wishlistNome && (
        <button
          onClick={onOpenWishlist}
          className="w-full text-left mt-3 p-3 rounded-2xl transition-opacity active:opacity-80"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
          }}
        >
          <p
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--accent)" }}
          >
            Desejo
          </p>
          <p
            className="font-semibold text-sm mt-1"
            style={{ color: "var(--text)" }}
          >
            {post.wishlistNome}
          </p>
          <div className="progress-track mt-2">
            <div
              className="progress-fill"
              style={{ width: `${post.wishlistProgresso ?? 0}%` }}
            />
          </div>
          <p
            className="text-[11px] mt-1.5 font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            {post.wishlistProgresso ?? 0}% da meta
          </p>
        </button>
      )}

      {/* Link */}
      {post.tipo === "link" && post.linkTitulo && (
        <div
          className="flex items-center gap-3 mt-3 p-3 rounded-2xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "rgb(var(--info-rgb) / 0.12)",
            }}
          >
            <Link2 size={16} style={{ color: "var(--info)" }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text)" }}
            >
              {post.linkTitulo}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {post.linkUrl}
            </p>
          </div>
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
            count={post.comentarios.length}
            onClick={() => onComment(post)}
            label="Comentar"
          />
          <ActionButton
            icon={<Share2 size={18} />}
            onClick={() => onShare(post)}
            label="Compartilhar"
          />
        </div>
        <ActionButton
          icon={
            <Bookmark
              size={18}
              fill={post.salvoPorMim ? "var(--accent)" : "none"}
            />
          }
          active={post.salvoPorMim}
          activeColor="var(--accent)"
          onClick={() => onToggleSave(post.id)}
          label="Salvar"
        />
      </div>
    </GlassCard>
  );
}
