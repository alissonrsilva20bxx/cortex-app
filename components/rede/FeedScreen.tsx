"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus, MessageCircle, Gift, Users2, Plus } from "lucide-react";
import { RedeHeader } from "./RedeHeader";
import { ContextualBlock } from "./ContextualBlock";
import { PostCard } from "./PostCard";
import { Avatar } from "./Avatar";
import { SkeletonList } from "./Skeleton";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import type { FeedPost } from "@/lib/rede/feed";
import type { PessoaResumo } from "@/lib/rede/perfis";
import type { WishlistItem } from "@/lib/rede/wishlist";
import type { Usuario } from "@/lib/types";

type Segmento = "paraVoce" | "amigas";

const ABAS: { id: Segmento; label: string }[] = [
  { id: "paraVoce", label: "Para você" },
  { id: "amigas", label: "Amigas" },
];

/**
 * Abas "Para você" / "Amigas" no visual do mockup da Jornada (J06): texto
 * com sublinhado na aba ativa, sobre uma linha divisória. Mesmo valor e
 * mesmo handler de antes (o filtro mora no RedeTab).
 */
function AbasFeed({
  segmento,
  onChange,
}: {
  segmento: Segmento;
  onChange: (s: Segmento) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex mb-4"
      style={{ gap: "22px", borderBottom: "1px solid var(--card-border)" }}
    >
      {ABAS.map((aba) => {
        const ativa = aba.id === segmento;
        return (
          <button
            key={aba.id}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onChange(aba.id)}
            style={{
              minHeight: "44px",
              fontSize: "14px",
              fontWeight: ativa ? 800 : 700,
              color: ativa ? "var(--text)" : "var(--text-muted)",
              borderBottom: ativa
                ? "2px solid var(--accent-deep)"
                : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {aba.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Fileira do topo do feed (mockup da Jornada, J06): "Postar" (abre o mesmo
 * composer de antes) e as amigas de verdade, com foto ou inicial e o nome.
 * Tocar numa amiga abre o perfil dela (onOpenAutor, o mesmo do feed).
 * Rola na horizontal -- o gesto de trocar de aba já ignora scrollers
 * horizontais (lib/useTabSwipe.ts).
 */
function FileiraAmigas({
  amigas,
  onPostar,
  onOpenAmiga,
}: {
  amigas: PessoaResumo[];
  onPostar: () => void;
  onOpenAmiga: (id: string) => void;
}) {
  const item = "flex flex-col items-center shrink-0 font-semibold";
  const rotulo = {
    fontSize: "11px",
    maxWidth: "64px",
    color: "var(--text)",
  } as const;
  return (
    <div
      className="flex overflow-x-auto no-scrollbar mb-4"
      style={{ gap: "14px" }}
    >
      <button
        type="button"
        onClick={onPostar}
        className={item}
        style={{ gap: "6px" }}
      >
        <span
          className="grid place-items-center rounded-full"
          style={{
            width: "62px",
            height: "62px",
            background: "var(--surface-sub)",
            border: "2px dashed var(--accent-deep)",
            color: "var(--accent-deep)",
          }}
        >
          <Plus size={22} strokeWidth={2.4} aria-hidden />
        </span>
        <span className="truncate" style={rotulo}>
          Postar
        </span>
      </button>

      {amigas.map((amiga) => (
        <button
          key={amiga.id}
          type="button"
          onClick={() => onOpenAmiga(amiga.id)}
          className={item}
          style={{ gap: "6px" }}
        >
          <span
            className="rounded-full"
            style={{
              width: "62px",
              height: "62px",
              padding: "3px",
              border: "2.5px solid var(--ring)",
            }}
          >
            <span
              className="grid place-items-center w-full h-full rounded-full overflow-hidden font-extrabold"
              style={{
                background: amiga.fotoUrl
                  ? undefined
                  : amiga.cor || "var(--accent)",
                color: "#fff",
                fontSize: "18px",
              }}
            >
              {amiga.fotoUrl ? (
                // URL do Storage é dinâmica por usuária (mesmo motivo do Avatar).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={amiga.fotoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                amiga.nome.charAt(0).toUpperCase()
              )}
            </span>
          </span>
          <span className="truncate" style={rotulo}>
            {amiga.nome.split(" ")[0]}
          </span>
        </button>
      ))}
    </div>
  );
}

interface ContextualBlockDef {
  key: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

interface Props {
  usuario: Usuario;
  usuarioFotoUrl: string | null;
  posts: FeedPost[];
  friends: string[];
  /** As mesmas amigas de `friends`, com nome e foto -- só pra fileira do topo. */
  amigas: PessoaResumo[];
  wishlistItems: WishlistItem[];
  pendingRequestsCount: number;
  unreadChats: number;
  unreadNotifs: number;
  /** Carregamento inicial do feed real (listarFeed) — mostra skeleton, não o empty-state. */
  loading: boolean;
  /** Filtro Para você / Amigas — mora no RedeTab pra sobreviver a remounts. */
  segmento: Segmento;
  onSegmentoChange: (s: Segmento) => void;
  /** listarFeed falhou — estado persistente, distinto do empty-state de "sem posts". */
  error: boolean;
  /** Ainda há posts mais antigos pra buscar (última página veio cheia). */
  hasMore: boolean;
  /** Buscando a próxima página agora — distinto do `loading` inicial. */
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Puxar o feed pra baixo no topo: resolve quando a busca termina. */
  onRefresh: () => Promise<void>;
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
  onRenovarFoto: (path: string) => Promise<string | null>;
}

export function FeedScreen({
  usuario,
  usuarioFotoUrl,
  posts,
  friends,
  amigas,
  wishlistItems,
  pendingRequestsCount,
  unreadChats,
  unreadNotifs,
  loading,
  error,
  hasMore,
  loadingMore,
  segmento,
  onSegmentoChange,
  onLoadMore,
  onRefresh,
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
  onRenovarFoto,
}: Props) {
  const visiblePosts = useMemo(
    () =>
      segmento === "paraVoce"
        ? posts
        : posts.filter(
            (p) => p.autorId === usuario.id || friends.includes(p.autorId)
          ),
    [posts, segmento, friends, usuario.id]
  );

  // A lista de amigas pode vir do cache local já na 1ª renderização do
  // cliente; o servidor não tem esse cache. Mostrar a fileira só depois de
  // montar evita somar uma diferença servidor x cliente à que já existe
  // (#130, fora deste ticket).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const wishlistPertoDaMeta = wishlistItems.find(
    (w) => w.estado !== "conquistado" && w.valorAtual / w.valorAlvo >= 0.7
  );

  const blocks: ContextualBlockDef[] = [];
  if (pendingRequestsCount > 0) {
    blocks.push({
      key: "solicitacoes",
      icon: <UserPlus size={17} style={{ color: "var(--accent)" }} />,
      title:
        pendingRequestsCount === 1
          ? "Você recebeu 1 solicitação de amizade"
          : `Você recebeu ${pendingRequestsCount} solicitações de amizade`,
      subtitle: "Toque para ver quem quer se conectar",
      onClick: onOpenAmigas,
    });
  }
  if (unreadChats > 0) {
    blocks.push({
      key: "mensagens",
      icon: <MessageCircle size={17} style={{ color: "var(--accent)" }} />,
      title:
        unreadChats === 1
          ? "1 mensagem não lida"
          : `${unreadChats} mensagens não lidas`,
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
  type FeedItem =
    | { type: "post"; post: FeedPost }
    | { type: "block"; block: ContextualBlockDef };
  const items: FeedItem[] = [];
  // Pedido de amizade esperando resposta vai no topo: entremeado nos posts
  // ele só aparecia a partir do 2º post (e nunca num feed vazio/curto).
  const pedidos = blocks.find((b) => b.key === "solicitacoes");
  if (pedidos) items.push({ type: "block", block: pedidos });
  const queue = blocks.filter((b) => b !== pedidos);
  visiblePosts.forEach((post, i) => {
    items.push({ type: "post", post });
    if ([1, 4, 6].includes(i) && queue.length) {
      items.push({ type: "block", block: queue.shift()! });
    }
  });

  return (
    <PullToRefresh onRefresh={onRefresh}>
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

        {/* Jornada J06: a entrada do composer virou o "Postar" da fileira
            de amigas (mesmo onOpenComposer), como no mockup. */}
        <FileiraAmigas
          amigas={montado ? amigas : []}
          onPostar={onOpenComposer}
          onOpenAmiga={onOpenAutor}
        />

        <AbasFeed segmento={segmento} onChange={onSegmentoChange} />

        {/* Entrada fixa pra Amigas/Solicitações/Descobrir — como no protótipo
          (linha própria logo abaixo dos tabs, sempre visível). Achado T20/#127:
          os blocos contextuais de "solicitações"/"descobrir" abaixo só
          aparecem intercalados no feed (após o 2º/5º/7º post — `queue.shift()`
          só roda dentro do `.forEach` de `visiblePosts`), então com feed vazio
          ou curto (comum pra quem acabou de entrar na Rede, que é justamente
          quem mais precisa achar gente) o acesso à tela de amigas ficava
          inatingível — violava "Preservar: Minhas amigas, Solicitações e
          Descobrir" do contrato. Reaproveita `onOpenAmigas`, já existente e já
          fiado a `AmigasScreen` em RedeTab.tsx — nenhuma lógica nova, só
          garante o caminho permanente que os blocos contextuais abaixo não
          garantem sozinhos. */}
        <ContextualBlock
          icon={<Users2 size={17} style={{ color: "var(--accent)" }} />}
          title="Amigas"
          subtitle="Solicitações e descobrir pessoas"
          onClick={onOpenAmigas}
        />

        <div className="space-y-3 mt-3">
          {/* Skeleton só em cache miss de verdade -- com posts cacheados em
            tela, um refresh em 2º plano (`loading` ainda true) NÃO volta pro
            skeleton, e uma falha de rede NÃO cobre o conteúdo com o erro
            (req 2 e 4). */}
          {loading && posts.length === 0 ? (
            <SkeletonList rows={3} />
          ) : error && posts.length === 0 ? (
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
                  onRenovarFoto={onRenovarFoto}
                />
              ) : (
                <div key={item.block.key}>
                  <ContextualBlock
                    icon={item.block.icon}
                    title={item.block.title}
                    subtitle={item.block.subtitle}
                    onClick={item.block.onClick}
                  />
                </div>
              )
            )
          )}
        </div>

        {!error && items.length > 0 && hasMore && (
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
    </PullToRefresh>
  );
}
