"use client";

import { Heart, MessageCircle, Share2, MoreHorizontal } from "lucide-react";
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
  /** Posição no feed: a referência alterna o tom do espaço da foto. */
  indice?: number;
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
      className="flex items-center transition-opacity active:opacity-60"
      style={{
        // Alvo de toque de 44 com o ícone de 24 da referência: o padding
        // cresce e a margem negativa devolve a altura desenhada.
        paddingTop: 10,
        paddingBottom: 10,
        marginTop: -10,
        marginBottom: -10,
        color: active ? activeColor : "var(--accent-deep)",
      }}
    >
      {icon}
    </button>
  );
}

/** "12 curtidas" / "1 curtida" -- o texto que a referência imprime. */
function curtidasTexto(n: number): string {
  return `${n} ${n === 1 ? "curtida" : "curtidas"}`;
}

export function PostCard({
  post,
  onToggleLike,
  onComment,
  onShare,
  onOpenMenu,
  onOpenAutor,
  onRenovarFoto,
  indice = 0,
}: Props) {
  const cat = CATEGORIA_META[post.categoria];

  return (
    <article className="flex flex-col" style={{ gap: "10px" }}>
      {/* Cabeçalho: 16px laterais, como na referência (só a foto sangra). */}
      <div
        className="flex items-center"
        style={{ gap: "10px", padding: "0 16px" }}
      >
        {/* 38px é o que a referência desenha; o alvo segue 44 por margem
            negativa (desenhoFixo). */}
        <Avatar
          nome={post.autorNome}
          cor={post.autorCor}
          fotoUrl={post.autorFotoUrl}
          tamanho={38}
          desenhoFixo
          onClick={() => onOpenAutor(post.autorId)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="truncate"
              style={{
                // A referência: 14px, peso 700, line-height 1,5 (21px). O
                // `font-semibold text-sm` dava 600 e 20px.
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: 1.5,
                color: "var(--text)",
              }}
            >
              {post.autorNome}
            </p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: `rgb(${cat.rgb} / 0.12)`,
                // #175: a cor da categoria sobre ela mesma a 12% ficava
                // abaixo de 4,5:1; misturada com --text, mantém o matiz e
                // passa nos 8 temas, claro e escuro.
                color: `color-mix(in srgb, rgb(${cat.rgb}) 62%, var(--text))`,
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

      {/* Fotos (0-2) -- foto grande no próprio card (sangra a padding), estilo
          Instagram. 2 fotos = carrossel com swipe. Miniatura como placeholder,
          principal sob demanda. A foto NÃO é interativa: fica no feed. */}
      {post.fotos.length > 0 && (
        <FeedFotos
          postId={post.id}
          fotos={post.fotos}
          autorNome={post.autorNome}
          onRenovarFoto={onRenovarFoto}
          // A referência alterna o tom do espaço da foto entre um artigo e
          // o seguinte: `--t-soft` e `--t-psoft`, que aqui são o
          // `--accent-tint` e o `--violet-tint`.
          tom={indice % 2 === 0 ? "var(--accent-tint)" : "var(--info-tint)"}
        />
      )}

      {/* Ações */}
      <div
        className="flex items-center"
        style={{ gap: "16px", padding: "0 16px" }}
      >
        <div className="flex items-center" style={{ gap: "16px" }}>
          <ActionButton
            icon={
              <Heart
                size={18}
                fill={post.curtidoPorMim ? "var(--danger)" : "none"}
              />
            }
            active={post.curtidoPorMim}
            activeColor="var(--danger)"
            onClick={() => onToggleLike(post.id)}
            label="Curtir"
          />
          <ActionButton
            icon={<MessageCircle size={18} />}
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

      {/* Curtidas e legenda, nesta ordem e com estes tamanhos, como a
          referência desenha. */}
      {post.curtidas > 0 && (
        <div style={{ padding: "0 16px", fontSize: "13px" }}>
          <strong>{curtidasTexto(post.curtidas)}</strong>
        </div>
      )}
      <div style={{ padding: "0 16px", fontSize: "14px", marginTop: "-4px" }}>
        <strong style={{ color: "var(--text)" }}>{post.autorNome}</strong>{" "}
        {post.texto}
      </div>
    </article>
  );
}
