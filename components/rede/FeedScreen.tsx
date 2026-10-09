"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, MessageCircle, Gift, Users2 } from "lucide-react";
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
import {
  ABAS_FEED,
  contarNovasDasAmigas,
  dicasDaSemana,
  gravarVisitaAmigas,
  lerUltimaVisitaAmigas,
  postsDasAmigas,
  separarNovas,
  type AbaFeed,
} from "@/lib/rede/abasFeed";

/** Altura da faixa das abas: 46 dos botões + 1 da linha de baixo. */
const ALTURA_ABAS = 47;

/** A área segura do topo (iPhone com notch no PWA), em px. */
function areaSeguraTopo(): number {
  const sonda = document.createElement("div");
  sonda.style.cssText =
    "position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(sonda);
  const h = sonda.offsetHeight;
  sonda.remove();
  return h;
}

/**
 * Prende as abas no topo ao rolar. `position: sticky` não serve aqui: o
 * `<main>` da casca tem `overflow-y: auto` mas não tem altura limitada, então
 * quem rola é a página, e o sticky ficaria preso ao `<main>`, que nunca rola.
 * Mexer na rolagem da casca mudaria todas as abas; então, quando a faixa
 * passa do topo, ela vira `fixed` (com a mesma largura e posição) e a casa
 * dela guarda a altura, sem salto. Aba escondida (`display: none`) nunca
 * fica presa.
 */
function useAbasPresas() {
  const casaRef = useRef<HTMLDivElement>(null);
  const [presa, setPresa] = useState<{ left: number; width: number } | null>(
    null
  );
  useEffect(() => {
    const casa = casaRef.current;
    if (!casa) return;
    const topo = areaSeguraTopo();
    let raf = 0;
    const medir = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!casa.offsetParent) {
          setPresa(null);
          return;
        }
        const r = casa.getBoundingClientRect();
        setPresa((antes) =>
          r.top < topo
            ? antes && antes.left === r.left && antes.width === r.width
              ? antes
              : { left: r.left, width: r.width }
            : null
        );
      });
    };
    medir();
    document.addEventListener("scroll", medir, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("scroll", medir, { capture: true });
      window.removeEventListener("resize", medir);
    };
  }, []);
  return { casaRef, presa };
}

/**
 * As 3 abas do feed (proposta "Três abas", feed-rede.html), no lugar da
 * fileira de amigas estilo stories: "Para você", "Amigas" e "Descobrir".
 * Grade de 3 colunas, 46px de altura, presa no topo ao rolar; a ativa em
 * --t-ink com o traço de 3px no acento; "Amigas" mostra quantas
 * publicações novas das amigas há desde a última visita.
 */
function Abas3({
  aba,
  novasAmigas,
  onChange,
}: {
  aba: AbaFeed;
  novasAmigas: number;
  onChange: (a: AbaFeed) => void;
}) {
  const { casaRef, presa } = useAbasPresas();
  return (
    <div ref={casaRef} style={{ height: ALTURA_ABAS }}>
      <div
        role="tablist"
        aria-label="Feed"
        data-abas-feed=""
        data-presa={presa ? "" : undefined}
        style={{
          position: presa ? "fixed" : "relative",
          top: presa ? 0 : undefined,
          left: presa ? presa.left : undefined,
          width: presa ? presa.width : undefined,
          // Presa no topo, a faixa cobre também a área do relógio (notch).
          paddingTop: presa ? "env(safe-area-inset-top, 0px)" : undefined,
          zIndex: 15,
          background: "var(--rede-bg)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          paddingLeft: 16,
          paddingRight: 16,
          borderBottom: "1px solid var(--t-line)",
        }}
      >
        {ABAS_FEED.map(({ id, rotulo }) => {
          const ativa = id === aba;
          const numero = id === "amigas" && !ativa ? novasAmigas : 0;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => onChange(id)}
              className="relative flex items-center justify-center"
              style={{
                minHeight: 46,
                gap: 6,
                fontSize: 14,
                fontWeight: 800,
                color: ativa ? "var(--t-ink)" : "var(--t-mut)",
              }}
            >
              {rotulo}
              {numero > 0 && (
                <em
                  aria-label={`${numero} novas`}
                  style={{
                    fontStyle: "normal",
                    fontSize: "10.5px",
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    borderRadius: 9,
                    background: "var(--t-acc)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {numero}
                </em>
              )}
              {ativa && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "22%",
                    right: "22%",
                    bottom: -1,
                    height: 3,
                    borderRadius: 3,
                    background: "var(--t-acc)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Novas desde a sua última visita" / "Já visto" na aba Amigas. */
function Divisor({ children }: { children: string }) {
  return (
    <div
      role="separator"
      className="flex items-center"
      style={{
        gap: 10,
        margin: "14px 16px 4px",
        fontSize: "11.5px",
        fontWeight: 800,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "var(--t-mut)",
      }}
    >
      <span style={{ flex: 1, height: 1, background: "var(--t-line)" }} />
      {children}
      <span style={{ flex: 1, height: 1, background: "var(--t-line)" }} />
    </div>
  );
}

function TituloSecao({ children }: { children: string }) {
  return (
    <h2
      style={{
        padding: "0 16px",
        margin: "16px 0 10px",
        fontSize: "13.5px",
        fontWeight: 800,
        color: "var(--t-ink)",
      }}
    >
      {children}
    </h2>
  );
}

/** Descobrir: cartão de pessoa para conhecer, com o mesmo "Adicionar" da
 * tela Amigas (envia o pedido de amizade). */
function CartaoPessoa({
  pessoa,
  enviado,
  onAdicionar,
  onAbrir,
}: {
  pessoa: PessoaResumo;
  enviado: boolean;
  onAdicionar: () => void;
  onAbrir: () => void;
}) {
  return (
    <div
      className="text-center"
      style={{
        background: "var(--t-card)",
        borderRadius: 20,
        padding: "14px 12px 12px",
        boxShadow: "0 0 0 1px var(--t-line)",
      }}
    >
      <div className="flex justify-center">
        <Avatar
          nome={pessoa.nome}
          cor={pessoa.cor}
          fotoUrl={pessoa.fotoUrl}
          tamanho={52}
          onClick={onAbrir}
        />
      </div>
      <b
        className="block truncate"
        style={{ fontSize: 14, marginTop: 8, color: "var(--t-ink)" }}
      >
        {pessoa.nome}
      </b>
      {pessoa.bio && (
        <small
          className="block truncate"
          style={{
            fontSize: "11.5px",
            color: "var(--t-mut)",
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          {pessoa.bio}
        </small>
      )}
      <button
        type="button"
        onClick={onAdicionar}
        disabled={enviado}
        className="w-full"
        style={{
          marginTop: 10,
          minHeight: 44,
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 13,
          background: enviado ? "var(--t-sub)" : "var(--t-acc)",
          color: enviado ? "var(--t-mut)" : "#fff",
        }}
      >
        {enviado ? "Pedido enviado" : "Adicionar"}
      </button>
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
  wishlistItems: WishlistItem[];
  pendingRequestsCount: number;
  unreadChats: number;
  unreadNotifs: number;
  /** Carregamento inicial do feed real (listarFeed) — mostra skeleton, não o empty-state. */
  loading: boolean;
  /** Aba Para você / Amigas / Descobrir — mora no RedeTab pra sobreviver a remounts. */
  segmento: AbaFeed;
  onSegmentoChange: (s: AbaFeed) => void;
  /** A Rede está na tela (o `active` que o RedeTab recebe). Montada em
   * segundo plano -- outra aba aberta, ou o remonte que a trava de PIN do
   * app causa na árvore inteira -- ela não conta como visita à aba Amigas. */
  ativa: boolean;
  /** Descobrir: pessoas sem relação ainda (as mesmas sugestões da tela Amigas). */
  sugestoes: PessoaResumo[];
  /** Ids com pedido de amizade já enviado ("Pedido enviado"). */
  sentRequests: string[];
  onSendRequest: (userId: string) => void;
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
  onToggleLike: (id: string) => void;
  onComment: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onOpenMenu: (post: FeedPost) => void;
  onOpenAutor: (autorId: string) => void;
  onRenovarFoto: (path: string) => Promise<string | null>;
}

/** Quantas pessoas a aba Descobrir mostra (2 por linha). */
const PESSOAS_NO_DESCOBRIR = 4;

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
  segmento,
  onSegmentoChange,
  ativa,
  sugestoes,
  sentRequests,
  onSendRequest,
  onLoadMore,
  onRefresh,
  onOpenSearch,
  onOpenNotifs,
  onOpenChat,
  onOpenMeuEspaco,
  onOpenAmigas,
  onOpenWishlist,
  onToggleLike,
  onComment,
  onShare,
  onOpenMenu,
  onOpenAutor,
  onRenovarFoto,
}: Props) {
  // Última visita à aba Amigas (neste aparelho). `corte` é a visita de
  // ANTES desta abertura da aba: é ele que separa "novas" de "já visto"
  // enquanto ela está aberta; ao entrar, a visita de agora é gravada. Só
  // conta com a Rede na tela (`ativa`): escondida, nada é gravado, e ao
  // voltar a ficar ativa em Amigas a visita é gravada de novo.
  // Lido só depois de montar: o servidor não tem o localStorage.
  const [ultimaVisita, setUltimaVisita] = useState<string | null>(null);
  const [corte, setCorte] = useState<string | null>(null);
  useEffect(() => {
    setUltimaVisita(lerUltimaVisitaAmigas(usuario.id));
  }, [usuario.id]);
  useEffect(() => {
    if (!(segmento === "amigas" && ativa)) return;
    const anterior = lerUltimaVisitaAmigas(usuario.id);
    setCorte(anterior);
    const agora = new Date();
    gravarVisitaAmigas(usuario.id, agora);
    setUltimaVisita(agora.toISOString());
  }, [segmento, ativa, usuario.id]);

  const daAmigas = useMemo(
    () => postsDasAmigas(posts, friends, usuario.id),
    [posts, friends, usuario.id]
  );
  const novasAmigas = contarNovasDasAmigas(posts, friends, ultimaVisita);

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
  // Para você: os blocos de aviso entremeados, como antes. Pedido de
  // amizade esperando resposta vai no topo: entremeado nos posts ele só
  // aparecia a partir do 2º post (e nunca num feed vazio/curto).
  const itensParaVoce: FeedItem[] = [];
  const pedidos = blocks.find((b) => b.key === "solicitacoes");
  if (pedidos) itensParaVoce.push({ type: "block", block: pedidos });
  const queue = blocks.filter((b) => b !== pedidos);
  posts.forEach((post, i) => {
    itensParaVoce.push({ type: "post", post });
    if ([1, 4, 6].includes(i) && queue.length) {
      itensParaVoce.push({ type: "block", block: queue.shift()! });
    }
  });

  const renderPost = (post: FeedPost) => (
    <PostCard
      post={post}
      amiga={friends.includes(post.autorId)}
      onToggleLike={onToggleLike}
      onComment={onComment}
      onShare={onShare}
      onOpenMenu={onOpenMenu}
      onOpenAutor={onOpenAutor}
      onRenovarFoto={onRenovarFoto}
    />
  );

  /** Lista de itens com a faixa de 8px entre um e outro (40px de respiro:
   * 22 embaixo do post + 18 em cima do próximo). */
  const lista = (itens: FeedItem[]) => (
    <div className="flex flex-col" data-feed-lista="">
      {itens.map((item, i) => (
        <div
          key={item.type === "post" ? item.post.id : item.block.key}
          style={i > 0 ? { borderTop: "8px solid var(--t-sub)" } : undefined}
        >
          {item.type === "post" ? (
            renderPost(item.post)
          ) : (
            <div style={{ padding: "16px" }}>
              <ContextualBlock
                icon={item.block.icon}
                title={item.block.title}
                subtitle={item.block.subtitle}
                onClick={item.block.onClick}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
  const soPosts = (ps: FeedPost[]): FeedItem[] =>
    ps.map((post) => ({ type: "post", post }));

  const vazio = (texto: string) => (
    <p
      className="text-sm text-center py-12"
      style={{ color: "var(--text-muted)" }}
    >
      {texto}
    </p>
  );

  let conteudo: React.ReactNode;
  if (segmento !== "descobrir" && loading && posts.length === 0) {
    conteudo = (
      <div style={{ padding: "14px 16px 0" }}>
        <SkeletonList rows={3} />
      </div>
    );
  } else if (segmento !== "descobrir" && error && posts.length === 0) {
    conteudo = (
      <p
        className="text-sm text-center py-12"
        style={{ color: "var(--danger)" }}
      >
        Não foi possível carregar o feed. Tente novamente mais tarde.
      </p>
    );
  } else if (segmento === "amigas") {
    const { novas, vistas, dividir } = separarNovas(daAmigas, corte);
    conteudo =
      daAmigas.length === 0 ? (
        vazio("Nenhuma publicação das suas amigas ainda.")
      ) : !dividir ? (
        lista(soPosts(novas))
      ) : (
        <>
          {novas.length > 0 && (
            <>
              <Divisor>Novas desde a sua última visita</Divisor>
              {lista(soPosts(novas))}
            </>
          )}
          {vistas.length > 0 && (
            <>
              <Divisor>Já visto</Divisor>
              {lista(soPosts(vistas))}
            </>
          )}
        </>
      );
  } else if (segmento === "descobrir") {
    const pessoas = sugestoes.slice(0, PESSOAS_NO_DESCOBRIR);
    const dicas = dicasDaSemana(posts);
    conteudo = (
      <>
        <TituloSecao>Pessoas para conhecer</TituloSecao>
        {pessoas.length === 0 ? (
          vazio("Ninguém novo por aqui agora.")
        ) : (
          <div
            className="grid"
            style={{
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              padding: "0 16px",
            }}
          >
            {pessoas.map((p) => (
              <CartaoPessoa
                key={p.id}
                pessoa={p}
                enviado={sentRequests.includes(p.id)}
                onAdicionar={() => onSendRequest(p.id)}
                onAbrir={() => onOpenAutor(p.id)}
              />
            ))}
          </div>
        )}
        <TituloSecao>Dicas mais curtidas da semana</TituloSecao>
        {dicas.length === 0
          ? vazio("Nenhuma dica nesta semana ainda.")
          : lista(soPosts(dicas))}
      </>
    );
  } else {
    conteudo =
      itensParaVoce.length === 0
        ? vazio("Nenhuma publicação por aqui ainda.")
        : lista(itensParaVoce);
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
      {/* A Rede vai de ponta a ponta: a casca do app dá `px-4` e
          `--space-shell-top` a TODAS as telas, então aqui a margem negativa
          devolve a borda e o topo só para esta tela. Cada bloco tem os seus
          16px; a foto do post sangra. */}
      <div
        className="pb-4"
        style={{
          margin: "-20px -16px 0",
          background: "var(--rede-bg)",
          minHeight: "100vh",
        }}
      >
        <div style={{ padding: "0 16px" }}>
          <RedeHeader
            usuarioNome={usuario.nome}
            usuarioFotoUrl={usuarioFotoUrl}
            unreadChats={unreadChats}
            unreadNotifs={unreadNotifs}
            onSearch={onOpenSearch}
            onOpenNotifs={onOpenNotifs}
            onOpenChat={onOpenChat}
            onOpenMeuEspaco={onOpenMeuEspaco}
            onOpenAmigas={onOpenAmigas}
            pendingRequestsCount={pendingRequestsCount}
          />
        </div>

        {/* Proposta "Três abas": as abas no lugar da fileira de amigas
            estilo stories (que saiu). O "Postar" que ela tinha fica no "+"
            da barra, como já era em toda a Rede. */}
        <Abas3
          aba={segmento}
          novasAmigas={novasAmigas}
          onChange={onSegmentoChange}
        />

        {conteudo}

        {segmento === "paraVoce" &&
          !error &&
          itensParaVoce.length > 0 &&
          hasMore && (
            <div style={{ padding: "0 16px" }}>
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
            </div>
          )}

        {/* Entrada permanente pra Amigas/Solicitações/Descobrir (achado
            T20/#127): continua INCONDICIONAL, então nunca some, nem com o
            feed vazio ou curto -- que é o que o contrato exige. Agora também
            no ícone de pessoas do cabeçalho, como a proposta desenha. */}
        <div style={{ padding: "0 16px", marginTop: "16px" }}>
          <ContextualBlock
            icon={<Users2 size={17} style={{ color: "var(--accent)" }} />}
            title="Amigas"
            subtitle="Solicitações e descobrir pessoas"
            onClick={onOpenAmigas}
          />
        </div>
      </div>
    </PullToRefresh>
  );
}
