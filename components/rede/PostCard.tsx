"use client";

import { Heart, MessageCircle, Send, MoreHorizontal } from "lucide-react";
import { Avatar } from "./Avatar";
import { FeedFotos } from "./FeedFotos";
import { formatRelativeTime } from "@/lib/mockRede";
import { CATEGORIA_META, type FeedPost } from "@/lib/rede/feed";

interface Props {
  post: FeedPost;
  onToggleLike: (id: string) => void;
  onComment: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onOpenMenu: (post: FeedPost) => void;
  onOpenAutor: (autorId: string) => void;
  /** URL assinada (5min) da MINIATURA pode expirar com a aba aberta --
   * chamado ao detectar falha de carregamento; devolve uma URL nova pro
   * mesmo path, ou `null` se a renovação falhar (ex.: bloqueio mudou). */
  onRenovarFoto: (path: string) => Promise<string | null>;
  /** A autora é amiga de quem lê: a linha do tempo ganha "· amiga". */
  amiga?: boolean;
}

/** Ação do post (proposta "Três abas"): ícone de 23 e o número ao lado,
 * alvo de toque de 44. */
function Acao({
  icon,
  count,
  active,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="inline-flex items-center active:opacity-60"
      style={{
        gap: 5,
        minHeight: 44,
        padding: "0 8px",
        borderRadius: 999,
        fontSize: "13.5px",
        fontWeight: 700,
        color: active ? "var(--t-acc)" : "var(--t-ink)",
      }}
    >
      {icon}
      {count != null && count > 0 && <span>{count}</span>}
    </button>
  );
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/**
 * Post da Rede no estilo do Instagram (proposta "Três abas, fotos no
 * formato do Instagram", feed-rede.html): sem cartão em volta, a foto de
 * ponta a ponta (FeedFotos, nos 4 formatos), o cabeçalho de 44px com o
 * avatar de 36, as ações com a contagem ao lado e a legenda embaixo.
 * Post só de texto mostra o texto maior antes das ações.
 */
export function PostCard({
  post,
  onToggleLike,
  onComment,
  onShare,
  onOpenMenu,
  onOpenAutor,
  onRenovarFoto,
  amiga = false,
}: Props) {
  const cat = CATEGORIA_META[post.categoria];
  const temFoto = post.fotos.length > 0;
  const nome = primeiroNome(post.autorNome);

  return (
    <article data-post={post.id} style={{ padding: "18px 0 22px" }}>
      {/* Cabeçalho: 16px à esquerda, 12 à direita, altura mínima 44. */}
      <div
        className="flex items-center"
        style={{ gap: 10, padding: "0 12px 0 16px", minHeight: 44 }}
      >
        <Avatar
          nome={post.autorNome}
          cor={post.autorCor}
          fotoUrl={post.autorFotoUrl}
          tamanho={36}
          desenhoFixo
          onClick={() => onOpenAutor(post.autorId)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center" style={{ gap: 6 }}>
            <button
              type="button"
              onClick={() => onOpenAutor(post.autorId)}
              className="truncate text-left"
              style={{
                fontSize: "14.5px",
                fontWeight: 800,
                color: "var(--t-ink)",
              }}
            >
              {nome}
            </button>
            <span
              className="shrink-0 rounded-full"
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                padding: "3px 8px",
                background: `rgb(${cat.rgb} / 0.12)`,
                // #175: a cor da categoria sobre ela mesma a 12% ficava
                // abaixo de 4,5:1; misturada com --text, mantém o matiz e
                // passa nos 8 temas, claro e escuro.
                color: `color-mix(in srgb, rgb(${cat.rgb}) 62%, var(--text))`,
              }}
            >
              {cat.label}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--t-mut)", marginTop: 1 }}>
            {formatRelativeTime(post.criadoEm)}
            {amiga ? " · amiga" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenMenu(post)}
          aria-label="Mais opções"
          className="grid place-items-center shrink-0 active:opacity-60"
          style={{
            width: 44,
            height: 44,
            margin: -2,
            color: "var(--t-mut)",
          }}
        >
          <MoreHorizontal size={21} />
        </button>
      </div>

      {temFoto ? (
        <div style={{ marginTop: 10 }}>
          <FeedFotos
            postId={post.id}
            fotos={post.fotos}
            autorNome={post.autorNome}
            onRenovarFoto={onRenovarFoto}
            tom="var(--t-sub)"
          />
        </div>
      ) : (
        <p
          data-post-texto=""
          style={{
            fontSize: 16,
            lineHeight: 1.5,
            margin: "10px 16px 0",
            color: "var(--t-ink)",
            whiteSpace: "pre-line",
          }}
        >
          {post.texto}
        </p>
      )}

      <div
        className="flex items-center"
        style={{ gap: 2, margin: "6px 8px 0" }}
      >
        <Acao
          icon={
            <Heart
              size={23}
              strokeWidth={2}
              fill={post.curtidoPorMim ? "currentColor" : "none"}
            />
          }
          count={post.curtidas}
          active={post.curtidoPorMim}
          onClick={() => onToggleLike(post.id)}
          label="Curtir"
        />
        <Acao
          icon={<MessageCircle size={23} strokeWidth={2} />}
          count={post.comentariosCount}
          onClick={() => onComment(post)}
          label="Comentar"
        />
        <Acao
          icon={<Send size={23} strokeWidth={2} />}
          onClick={() => onShare(post)}
          label="Compartilhar"
        />
      </div>

      {temFoto && (
        <p
          data-post-legenda=""
          style={{
            fontSize: "14.5px",
            lineHeight: 1.5,
            margin: "2px 16px 0",
            color: "var(--t-ink)",
            whiteSpace: "pre-line",
          }}
        >
          <b style={{ fontWeight: 800 }}>{nome}</b> {post.texto}
        </p>
      )}
    </article>
  );
}
