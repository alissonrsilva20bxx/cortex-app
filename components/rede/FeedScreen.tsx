"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, MessageCircle, Gift, Users2 } from "lucide-react";
import { RedeHeader } from "./RedeHeader";
import { ContextualBlock } from "./ContextualBlock";
import { PostCard } from "./PostCard";
import { Avatar } from "./Avatar";
import { SkeletonList } from "./Skeleton";
import { IconeCamera, IconeVoltar } from "./redeIcones";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import type { FeedPost } from "@/lib/rede/feed";
import type { WishlistItem } from "@/lib/rede/wishlist";
import { progressoDesejo } from "@/lib/desejo/desejo";
import { TEXTOS_DESEJO } from "@/lib/desejo/textos";
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
import s from "./doca.module.css";

/** Altura da faixa das abas: o trilho de 52 (44 dos botões + 4 + 4) e 12
 * de respiro embaixo. */
const ALTURA_ABAS = 64;

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
 * Prende um pedaço da tela no topo ao rolar. `position: sticky` não serve
 * aqui: o `<main>` da casca tem `overflow-y: auto` mas não tem altura
 * limitada, então quem rola é a página, e o sticky ficaria preso ao
 * `<main>`, que nunca rola. Mexer na rolagem da casca mudaria todas as
 * abas; então, quando a faixa passa do topo (mais o `deslocamento`, para
 * a pílula parar logo abaixo das abas presas), ela vira `fixed` (com a
 * mesma largura e posição) e a casa dela guarda a altura, sem salto. Aba
 * escondida (`display: none`) nunca fica presa.
 */
function useAbasPresas(deslocamento = 0) {
  const casaRef = useRef<HTMLDivElement>(null);
  const [presa, setPresa] = useState<{ left: number; width: number } | null>(
    null
  );
  useEffect(() => {
    const casa = casaRef.current;
    if (!casa) return;
    const topo = areaSeguraTopo() + deslocamento;
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
  }, [deslocamento]);
  return { casaRef, presa };
}

/**
 * As 3 abas do feed ("Para você", "Amigas" e "Descobrir") no desenho do
 * modelo Doca: um trilho com o fundo do cartão deslizando até a aba
 * tocada. Presa no topo ao rolar; "Amigas" mostra quantas publicações
 * novas das amigas há desde a última visita.
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
  const indice = Math.max(
    0,
    ABAS_FEED.findIndex((a) => a.id === aba)
  );
  return (
    <div ref={casaRef} style={{ height: ALTURA_ABAS }}>
      <div
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
          paddingLeft: 14,
          paddingRight: 14,
          paddingBottom: 12,
        }}
      >
        <div
          role="tablist"
          aria-label="Feed"
          className="relative grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            padding: 4,
            borderRadius: 16,
            background: "var(--surface-2)",
          }}
        >
          {/* O fundo da aba ativa: desliza até a aba tocada. */}
          <span
            aria-hidden
            data-indicador-aba=""
            className="absolute"
            style={{
              top: 4,
              bottom: 4,
              left: 4,
              width: "calc((100% - 8px) / 3)",
              borderRadius: 12,
              background: "var(--card-solid)",
              boxShadow: "0 2px 10px rgb(0 0 0 / 0.2)",
              transform: `translateX(${indice * 100}%)`,
              transition: "transform 380ms cubic-bezier(.3,1.3,.5,1)",
            }}
          />
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
                  zIndex: 1,
                  minHeight: 44,
                  gap: 6,
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 800,
                  color: ativa ? "var(--text)" : "var(--text-2)",
                  transition: "color 200ms ease",
                }}
              >
                {rotulo}
                {numero > 0 && (
                  <em
                    aria-label={`${numero} novas`}
                    style={{
                      fontStyle: "normal",
                      fontSize: 11,
                      minWidth: 20,
                      height: 20,
                      padding: "0 6px",
                      borderRadius: 999,
                      background: "var(--accent)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {numero}
                  </em>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** "Novas desde a sua última visita" / "Já visto" na aba Amigas. */
function Divisor({ children, marca }: { children: string; marca?: boolean }) {
  return (
    <div
      role="separator"
      data-novas={marca ? "" : undefined}
      className="flex items-center"
      style={{
        gap: 10,
        margin: "6px 16px 12px",
        fontSize: 13,
        fontWeight: 800,
        color: "var(--accent-deep-2)",
      }}
    >
      {children}
      <span style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
    </div>
  );
}

/**
 * Pílula "N novas" (só na aba Amigas): quantas publicações das amigas
 * chegaram desde a última visita. Entra deslizando de cima, pulsa uma vez
 * e, tocada, leva até o divisor "Novas" e some. Ao rolar, para logo abaixo
 * das abas presas.
 */
function PilulaNovas({ n, onIr }: { n: number; onIr: () => void }) {
  const { casaRef, presa } = useAbasPresas(ALTURA_ABAS + 6);
  return (
    <div ref={casaRef} style={{ height: 52 }}>
      <div
        className="flex justify-center"
        style={{
          position: presa ? "fixed" : "relative",
          top: presa
            ? `calc(env(safe-area-inset-top, 0px) + ${ALTURA_ABAS + 6}px)`
            : undefined,
          left: presa ? presa.left : undefined,
          width: presa ? presa.width : "100%",
          zIndex: 14,
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          onClick={onIr}
          data-pilula-novas=""
          aria-label={`${n} ${n === 1 ? "publicação nova" : "publicações novas"} das amigas. Toque para ir até elas`}
          className={s.pilula}
        >
          <span style={{ transform: "rotate(90deg)", display: "grid" }}>
            <IconeVoltar size={18} strokeWidth={2.6} />
          </span>
          {n} {n === 1 ? "nova" : "novas"}
        </button>
      </div>
    </div>
  );
}

/** Atalho para publicar no topo de "Para você": o mesmo compositor do
 * botão do meio da barra. O cartão inteiro é o alvo de toque. */
function CriarPost({
  nome,
  fotoUrl,
  onCriar,
}: {
  nome: string;
  fotoUrl: string | null;
  onCriar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCriar}
      data-criar-post=""
      className="flex items-center w-full text-left transition-transform active:scale-[0.98]"
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 22,
        background: "var(--card-solid)",
        boxShadow: "inset 0 0 0 1px var(--border-color)",
      }}
    >
      <Avatar nome={nome} fotoUrl={fotoUrl} size="md" />
      <span
        className="flex-1 min-w-0"
        style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)" }}
      >
        Conta pra gente: o que rolou hoje?
      </span>
      <span
        aria-hidden
        className="grid place-items-center shrink-0"
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: "var(--accent-tint)",
          color: "var(--accent-deep-2)",
        }}
      >
        <IconeCamera />
      </span>
    </button>
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
  /** Carregamento inicial do feed real (listarFeed) — mostra skeleton, não o empty-state. */
  loading: boolean;
  /** Aba Para você / Amigas / Descobrir — mora no RedeTab pra sobreviver a remounts. */
  segmento: AbaFeed;
  onSegmentoChange: (s: AbaFeed) => void;
  /** A Rede está na tela (o `active` que o RedeTab recebe). Montada em
   * segundo plano -- outra aba aberta, ou o remonte que a trava de PIN do
   * app causa na árvore inteira -- ela não conta como visita à aba Amigas. */
  ativa: boolean;
  /** listarFeed falhou — estado persistente, distinto do empty-state de "sem posts". */
  error: boolean;
  /** Ainda há posts mais antigos pra buscar (última página veio cheia). */
  hasMore: boolean;
  /** Buscando a próxima página agora — distinto do `loading` inicial. */
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Puxar o feed pra baixo no topo: resolve quando a busca termina. */
  onRefresh: () => Promise<void>;
  /** Abre o compositor (o mesmo do botão do meio da barra da Rede). */
  onCriarPost: () => void;
  onOpenChat: () => void;
  onOpenAmigas: () => void;
  onOpenWishlist: () => void;
  onToggleLike: (id: string) => void;
  onComment: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onOpenMenu: (post: FeedPost) => void;
  onOpenAutor: (autorId: string) => void;
  onRenovarFoto: (path: string) => Promise<string | null>;
}

/** O espaço que fica embaixo do feed, fora dele: os 160px que a casca do
 * app deixa em toda tela (`pb-40` em app/page.tsx) e os 16px do `pb-4` do
 * RedeTab. A Rede pinta o próprio fundo também nele. */
const SOBRA_DA_CASCA = 160 + 16;

export function FeedScreen({
  usuario,
  usuarioFotoUrl,
  posts,
  friends,
  wishlistItems,
  pendingRequestsCount,
  unreadChats,
  loading,
  error,
  hasMore,
  loadingMore,
  segmento,
  onSegmentoChange,
  ativa,
  onLoadMore,
  onRefresh,
  onCriarPost,
  onOpenChat,
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
  // A pílula "N novas" volta a cada entrada na aba e some quando tocada.
  const [pilulaFechada, setPilulaFechada] = useState(false);
  useEffect(() => {
    setUltimaVisita(lerUltimaVisitaAmigas(usuario.id));
  }, [usuario.id]);
  useEffect(() => {
    if (!(segmento === "amigas" && ativa)) return;
    const anterior = lerUltimaVisitaAmigas(usuario.id);
    setCorte(anterior);
    setPilulaFechada(false);
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
    (w) =>
      w.estado !== "conquistado" &&
      progressoDesejo(w.valorAtual, w.valorAlvo) >= 70
  );

  const blocks: ContextualBlockDef[] = [];
  if (pendingRequestsCount > 0) {
    blocks.push({
      key: "solicitacoes",
      icon: <UserPlus size={18} />,
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
      icon: <MessageCircle size={18} />,
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
      icon: <Gift size={18} />,
      title: TEXTOS_DESEJO.pertoDoAlvo,
      subtitle: `${wishlistPertoDaMeta.nome} — ${progressoDesejo(wishlistPertoDaMeta.valorAtual, wishlistPertoDaMeta.valorAlvo)}%`,
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

  /** Lista de cartões, 12px entre um e outro. `posicao` numera os cartões
   * (o melhor da semana mostra 1º, 2º...). */
  const lista = (itens: FeedItem[], posicao = false) => (
    <div
      className="flex flex-col"
      style={{ gap: 12, padding: "0 14px" }}
      data-feed-lista=""
    >
      {itens.map((item, i) => (
        <div
          key={item.type === "post" ? item.post.id : item.block.key}
          className="relative"
        >
          {posicao && (
            <span
              aria-label={`${i + 1}º lugar`}
              data-posicao={i + 1}
              className="absolute grid place-items-center"
              style={{
                top: -6,
                right: 14,
                zIndex: 4,
                minWidth: 30,
                height: 24,
                padding: "0 8px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background: i < 3 ? "var(--accent)" : "var(--accent-tint)",
                color: i < 3 ? "#fff" : "var(--accent-deep-2)",
                boxShadow:
                  i < 3 ? "0 4px 12px rgb(var(--accent-rgb) / 0.4)" : undefined,
              }}
            >
              {i + 1}º
            </span>
          )}
          {item.type === "post" ? (
            renderPost(item.post)
          ) : (
            <ContextualBlock
              icon={item.block.icon}
              title={item.block.title}
              subtitle={item.block.subtitle}
              onClick={item.block.onClick}
            />
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

  /** Pílula tocada: rola até o divisor "Novas", abaixo das abas presas. */
  function irParaNovas() {
    setPilulaFechada(true);
    const alvo = document.querySelector<HTMLElement>("[data-novas]");
    if (!alvo) return;
    const reduzido =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const y =
      alvo.getBoundingClientRect().top +
      window.scrollY -
      areaSeguraTopo() -
      ALTURA_ABAS -
      8;
    window.scrollTo({
      top: Math.max(0, y),
      behavior: reduzido ? "auto" : "smooth",
    });
  }

  let conteudo: React.ReactNode;
  if (loading && posts.length === 0) {
    conteudo = (
      <div style={{ padding: "0 14px" }}>
        <SkeletonList rows={3} />
      </div>
    );
  } else if (error && posts.length === 0) {
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
    // Só as das amigas contam para a pílula (as suas não são "novas").
    const nPilula = dividir
      ? contarNovasDasAmigas(daAmigas, friends, corte)
      : 0;
    conteudo =
      daAmigas.length === 0 ? (
        vazio("Nenhuma publicação das suas amigas ainda.")
      ) : !dividir ? (
        lista(soPosts(novas))
      ) : (
        <>
          {nPilula > 0 && !pilulaFechada && (
            <PilulaNovas n={nPilula} onIr={irParaNovas} />
          )}
          {novas.length > 0 && (
            <>
              <Divisor marca>Novas desde a sua última visita</Divisor>
              {lista(soPosts(novas))}
            </>
          )}
          {vistas.length > 0 && (
            <>
              <div style={{ height: novas.length > 0 ? 16 : 0 }} />
              <Divisor>Já visto</Divisor>
              {lista(soPosts(vistas))}
            </>
          )}
        </>
      );
  } else if (segmento === "descobrir") {
    // "O melhor da semana": só as dicas dos últimos 7 dias, das mais
    // curtidas (empate: a mais nova primeiro) -- calculado com o feed que
    // já está carregado, sem tabela nova. As pessoas para conhecer saíram
    // daqui: repetiam a tela Amigas (que tem "Descobrir pessoas").
    const dicas = dicasDaSemana(posts);
    conteudo = (
      <>
        <div style={{ padding: "2px 16px 14px" }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
            O melhor da semana
          </h2>
          <p
            style={{
              fontSize: "13.5px",
              fontWeight: 600,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            As dicas mais curtidas dos últimos 7 dias
          </p>
        </div>
        {dicas.length === 0
          ? vazio("Nenhuma dica nesta semana ainda.")
          : lista(soPosts(dicas), true)}
      </>
    );
  } else {
    conteudo = (
      <>
        <div style={{ padding: "0 14px 12px" }}>
          <CriarPost
            nome={usuario.nome}
            fotoUrl={usuarioFotoUrl}
            onCriar={onCriarPost}
          />
        </div>
        {itensParaVoce.length === 0
          ? vazio("Nenhuma publicação por aqui ainda.")
          : lista(itensParaVoce)}
      </>
    );
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
      {/* A Rede vai de ponta a ponta: a casca do app dá `px-4` e
          `--space-shell-top` a TODAS as telas, então aqui a margem negativa
          devolve a borda e o topo só para esta tela. Cada bloco tem os seus
          14/16px.
          Embaixo sobram 176px fora deste fundo (`pb-40` da casca, espaço
          da barra de abas, e `pb-4` do RedeTab), que mostravam o degradê
          do tema (a faixa rosa nos temas pink e crimson). A margem
          negativa puxa esse espaço para dentro da Rede e o padding devolve a mesma
          altura (mais os 16px de antes e a área do indicador de início do
          iPhone), então nada muda de lugar e o fundo vai até o fim. 100dvh
          pelo mesmo motivo do `body` em styles/globals.css: no app
          instalado, 100vh não cobre a área segura de baixo. */}
      <div
        style={{
          margin: `-20px -16px -${SOBRA_DA_CASCA}px`,
          paddingBottom: `calc(${SOBRA_DA_CASCA + 16}px + env(safe-area-inset-bottom, 0px))`,
          background: "var(--rede-bg)",
          minHeight: "100dvh",
        }}
      >
        <div style={{ padding: "0 16px" }}>
          <RedeHeader />
        </div>

        <Abas3
          aba={segmento}
          novasAmigas={novasAmigas}
          onChange={onSegmentoChange}
        />

        {/* A chave troca com a aba: o conteúdo novo entra subindo 8px. */}
        <div key={segmento} className={s.entra}>
          {conteudo}
        </div>

        {segmento === "paraVoce" &&
          !error &&
          itensParaVoce.length > 0 &&
          hasMore && (
            <div style={{ padding: "0 14px" }}>
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold transition-opacity active:opacity-70 disabled:opacity-50"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-2)",
                  minHeight: 48,
                }}
              >
                {loadingMore ? "Carregando…" : "Carregar mais publicações"}
              </button>
            </div>
          )}

        {/* Entrada permanente pra Amigas/Solicitações/Descobrir (achado
            T20/#127): continua INCONDICIONAL, então nunca some, nem com o
            feed vazio ou curto -- que é o que o contrato exige. No modelo
            Doca, Amigas também está na barra da Rede. */}
        <div style={{ padding: "0 14px", marginTop: "16px" }}>
          <ContextualBlock
            icon={<Users2 size={18} />}
            title="Amigas"
            subtitle="Solicitações e descobrir pessoas"
            onClick={onOpenAmigas}
          />
        </div>
      </div>
    </PullToRefresh>
  );
}
