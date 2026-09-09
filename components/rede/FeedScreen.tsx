"use client";

import { useMemo, useState } from "react";
import { UserPlus, MessageCircle, Gift, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { RedeHeader } from "./RedeHeader";
import { ContextualBlock } from "./ContextualBlock";
import { PostCard } from "./PostCard";
import { Avatar } from "./Avatar";
import { SkeletonList } from "./Skeleton";
import { DISCOVER_PEOPLE, findUser } from "@/lib/mockRede";
import type { FeedPost } from "@/lib/rede/feed";
import type { WishlistItem } from "@/lib/rede/wishlist";
import type { Usuario } from "@/lib/types";

type Segmento = "paraVoce" | "amigas";

interface ContextualBlockDef {
  key: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  /**
   * Bloco alimentado por fixture local (lib/mockRede.ts), sem tabela real
   * por trás — precisa de rótulo visível pra não ficar indistinguível dos
   * blocos reais (solicitações de amizade, mensagens não lidas). Ver T7,
   * achado P0 do relatório de paridade do Feed.
   */
  demo?: boolean;
}

interface Props {
  usuario: Usuario;
  usuarioFotoUrl: string | null;
  posts: FeedPost[];
  friends: string[];
  wishlistItems: WishlistItem[];
  pendingRequestsCount: number;
  unreadChats: number;
  unreadNotifs: number;
  /** Carregamento inicial do feed real (listarFeed) — mostra skeleton, não o empty-state. */
  loading: boolean;
  /** listarFeed falhou — estado persistente, distinto do empty-state de "sem posts". */
  error: boolean;
  /** Ainda há posts mais antigos pra buscar (última página veio cheia). */
  hasMore: boolean;
  /** Buscando a próxima página agora — distinto do `loading` inicial. */
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpenSearch: () => void;
  onOpenNotifs: () => void;
  onOpenChat: () => void;
  onOpenMeuEspaco: () => void;
  onOpenAmigas: () => void;
  onOpenWishlist: () => void;
  onOpenComposer: () => void;
  onToggleLike: (id: string) => void;
  onComment: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onOpenMenu: (post: FeedPost) => void;
  onOpenAutor: (autorId: string) => void;
}

export function FeedScreen({
  usuario,
  usuarioFotoUrl,
  posts,
  friends,
  wishlistItems,
  pendingRequestsCount,
  unreadChats,
  unreadNotifs,
  loading,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpenSearch,
  onOpenNotifs,
  onOpenChat,
  onOpenMeuEspaco,
  onOpenAmigas,
  onOpenWishlist,
  onOpenComposer,
  onToggleLike,
  onComment,
  onShare,
  onOpenMenu,
  onOpenAutor,
}: Props) {
  const [segmento, setSegmento] = useState<Segmento>("paraVoce");

  const visiblePosts = useMemo(
    () =>
      segmento === "paraVoce"
        ? posts
        : posts.filter(
            (p) => p.autorId === usuario.id || friends.includes(p.autorId)
          ),
    [posts, segmento, friends]
  );

  const wishlistPertoDaMeta = wishlistItems.find(
    (w) => w.estado !== "conquistado" && w.valorAtual / w.valorAlvo >= 0.7
  );
  const discover = DISCOVER_PEOPLE.map((d) => findUser(d.userId)).filter(
    Boolean
  );

  const blocks: ContextualBlockDef[] = [];
  if (pendingRequestsCount > 0) {
    blocks.push({
      key: "solicitacoes",
      icon: <UserPlus size={17} style={{ color: "var(--accent)" }} />,
      title: `Você recebeu ${pendingRequestsCount} solicitações de amizade`,
      subtitle: "Toque para ver quem quer se conectar",
      onClick: onOpenAmigas,
    });
  }
  if (unreadChats > 0) {
    blocks.push({
      key: "mensagens",
      icon: <MessageCircle size={17} style={{ color: "var(--accent)" }} />,
      title: `${unreadChats} mensagens não lidas`,
      subtitle: "Suas conversas estão esperando",
      onClick: onOpenChat,
    });
  }
  if (wishlistPertoDaMeta) {
    blocks.push({
      key: "wishlist",
      icon: <Gift size={17} style={{ color: "var(--accent)" }} />,
      title: "Desejo próximo da meta",
      subtitle: `${wishlistPertoDaMeta.nome} — ${Math.round((wishlistPertoDaMeta.valorAtual / wishlistPertoDaMeta.valorAlvo) * 100)}%`,
      onClick: onOpenWishlist,
    });
  }
  if (discover.length > 0) {
    blocks.push({
      key: "descobrir",
      icon: <Sparkles size={17} style={{ color: "var(--accent)" }} />,
      title: "Pessoas que talvez você conheça",
      subtitle: discover.map((u) => u!.nome.split(" ")[0]).join(", "),
      onClick: onOpenAmigas,
      demo: true,
    });
  }

  const queue = [...blocks];
  type FeedItem =
    | { type: "post"; post: FeedPost }
    | { type: "block"; block: ContextualBlockDef };
  const items: FeedItem[] = [];
  visiblePosts.forEach((post, i) => {
    items.push({ type: "post", post });
    if ([1, 4, 6].includes(i) && queue.length) {
      items.push({ type: "block", block: queue.shift()! });
    }
  });

  return (
    <div className="pb-4">
      <RedeHeader
        usuarioNome={usuario.nome}
        usuarioFotoUrl={usuarioFotoUrl}
        unreadChats={unreadChats}
        unreadNotifs={unreadNotifs}
        onSearch={onOpenSearch}
        onOpenNotifs={onOpenNotifs}
        onOpenChat={onOpenChat}
        onOpenMeuEspaco={onOpenMeuEspaco}
      />

      {/* Compositor — entrada estática, abre o composer completo em sheet */}
      <GlassCard
        as="button"
        radius="lg"
        onClick={onOpenComposer}
        className="flex items-center gap-3 px-4 py-3.5 mb-4"
      >
        <Avatar nome={usuario.nome} fotoUrl={usuarioFotoUrl} size="md" />
        <span
          className="flex-1 text-sm text-left"
          style={{ color: "var(--text-muted)" }}
        >
          Compartilhe algo…
        </span>
      </GlassCard>

      <SegmentedControl<Segmento>
        className="mb-4"
        value={segmento}
        onChange={setSegmento}
        options={[
          { id: "paraVoce", label: "Para você" },
          { id: "amigas", label: "Amigas" },
        ]}
      />

      <div className="space-y-3">
        {loading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--danger)" }}
          >
            Não foi possível carregar o feed. Tente novamente mais tarde.
          </p>
        ) : items.length === 0 ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            {segmento === "amigas"
              ? "Nenhuma publicação das suas amigas ainda."
              : "Nenhuma publicação por aqui ainda."}
          </p>
        ) : (
          items.map((item) =>
            item.type === "post" ? (
              <PostCard
                key={item.post.id}
                post={item.post}
                onToggleLike={onToggleLike}
                onComment={onComment}
                onShare={onShare}
                onOpenMenu={onOpenMenu}
                onOpenAutor={onOpenAutor}
              />
            ) : (
              <div key={item.block.key}>
                <ContextualBlock
                  icon={item.block.icon}
                  title={item.block.title}
                  subtitle={item.block.subtitle}
                  onClick={item.block.onClick}
                />
                {item.block.demo && (
                  <p
                    className="text-center text-[11px] font-semibold mt-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Demonstração — sugestão de exemplo, ainda sem dado real por
                    trás
                  </p>
                )}
              </div>
            )
          )
        )}
      </div>

      {!loading && !error && items.length > 0 && hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold transition-opacity active:opacity-70 disabled:opacity-50"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
            color: "var(--text-2)",
          }}
        >
          {loadingMore ? "Carregando…" : "Carregar mais publicações"}
        </button>
      )}
    </div>
  );
}
