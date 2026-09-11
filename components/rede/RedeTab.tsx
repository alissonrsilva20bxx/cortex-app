"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Link2,
  Flag,
  Pencil,
  Trash2,
  Send,
  X,
  Ban,
  Camera,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { FeedScreen } from "./FeedScreen";
import { SearchScreen } from "./SearchScreen";
import { AmigasScreen } from "./AmigasScreen";
import { ChatListScreen } from "./ChatListScreen";
import { ChatThreadScreen, type ChatMessage } from "./ChatThreadScreen";
import { MeuEspacoScreen } from "./MeuEspacoScreen";
import { PerfilPublicoScreen } from "./PerfilPublicoScreen";
import { WishlistScreen } from "./WishlistScreen";
import { WishlistForm, WISHLIST_PALETTE } from "./WishlistForm";
import { ClientesScreen } from "./ClientesScreen";
import { BlockedUsersScreen } from "./BlockedUsersScreen";
import { ClienteDetailSheet } from "./ClienteDetailSheet";
import { ClienteForm } from "./ClienteForm";
import { PostComposer } from "./PostComposer";
import { CommentsSheet } from "./CommentsSheet";
import { RedeNotificationsSheet } from "./RedeNotificationsSheet";
import { OptionsSheet } from "./OptionsSheet";
import { ShareToChatSheet } from "./ShareToChatSheet";
import { LiveLinkForm } from "./LiveLinkForm";
import { ProfileEditForm } from "./ProfileEditForm";
import { type LiveLink } from "./LiveLinksSection";
import { findUser, type Privacidade } from "@/lib/mockRede";
import { supabase } from "@/lib/supabase";
import {
  buscarPerfil,
  criarPerfil,
  atualizarPerfil,
  criarLiveLink,
  atualizarLiveLink,
  listarLiveLinks,
  reordenarLiveLinks,
  excluirLiveLink,
  buscarPessoas,
  type PessoaResumo,
} from "@/lib/rede/perfis";
import {
  criarWishlistItem,
  atualizarWishlistItem,
  listarWishlistItems,
  excluirWishlistItem,
  type WishlistItem,
} from "@/lib/rede/wishlist";
import {
  criarCliente,
  atualizarCliente,
  listarClientes,
  excluirCliente,
  type Cliente,
} from "@/lib/rede/clientes";
import {
  listarFeed,
  criarPost,
  atualizarPost,
  excluirPost,
  listarComentarios,
  criarComentario,
  alternarCurtida,
  renovarUrlFoto,
  FEED_PAGE_SIZE,
  type FeedPost,
  type FeedComment,
  type FotoPost,
  type FotoParaUpload,
  type Categoria,
} from "@/lib/rede/feed";
import { criarDenuncia, type CriarDenunciaInput } from "@/lib/rede/denuncias";
import {
  listarAmigas,
  listarSolicitacoesPendentes,
  listarSolicitacoesEnviadas,
  listarSugestoes,
  enviarPedidoAmizade,
  aceitarPedidoAmizade,
  recusarPedidoAmizade,
  removerAmizade,
  bloquearUsuario,
  desbloquearUsuario,
  type SolicitacaoAmizade,
} from "@/lib/rede/social";
import { listarBloqueadosComNome } from "@/lib/rede/bloqueiosGerenciamento";
import {
  listarConversas,
  listarMensagens,
  MENSAGENS_PAGE_SIZE,
  enviarMensagem,
  marcarMensagemComoLida,
  abrirConversa1a1,
  assinarMensagensConversa,
  reconcileConfirmedMessage,
  ocultarConversa,
  type ConversaResumo,
} from "@/lib/rede/mensagens";
import {
  listarNotificacoes,
  marcarNotificacoesVistas,
  type Notificacao,
} from "@/lib/rede/notificacoes";
import * as redeCache from "@/lib/rede/redeCache";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import type { Database } from "@/lib/database.types";
import type { Usuario } from "@/lib/types";

// useLayoutEffect avisa "does nothing on the server" no SSR de um
// componente client — cai pra useEffect nesse lado (nunca roda no servidor
// mesmo) e só usa a versão síncrona no cliente, onde o timing pré-paint da
// restauração de rolagem importa (mesmo padrão de app/page.tsx).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Perfil = Database["public"]["Tables"]["rede_perfis"]["Row"];

/** Agregado do perfil cacheado como um recurso só (vêm do mesmo effect). */
interface PerfilCache {
  perfil: Perfil | null;
  liveLinks: LiveLink[];
  wishlistItems: WishlistItem[];
  clientes: Cliente[];
}

interface AmigasCache {
  friends: PessoaResumo[];
  requests: SolicitacaoAmizade[];
  sentRequests: string[];
  sugestoes: PessoaResumo[];
}
type DenunciaMotivo = CriarDenunciaInput["motivo"];

const CORES_AVATAR = [
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#6366f1",
];

function corAvatarAleatoria(): string {
  return CORES_AVATAR[Math.floor(Math.random() * CORES_AVATAR.length)];
}

const AVATAR_STORAGE_MARKER = "/object/public/avatares/";

/** Extrai o path do objeto no Storage a partir da URL pública salva em
 * `avatar_url`, pra poder apagar o arquivo antigo ao trocar/remover a foto
 * (sem isso, cada troca deixa um arquivo órfão no bucket pra sempre). */
function avatarPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const idx = url.indexOf(AVATAR_STORAGE_MARKER);
  if (idx === -1) return null;
  return url.slice(idx + AVATAR_STORAGE_MARKER.length);
}

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

type RedeScreen =
  | { type: "feed" }
  | { type: "busca" }
  | { type: "amigas" }
  | { type: "chatList" }
  | { type: "chatThread"; conversationId: string }
  | { type: "meuEspaco" }
  | { type: "perfilPublico"; userId: string }
  | { type: "wishlist" }
  | { type: "clientes" }
  | { type: "bloqueados" };

interface Props {
  usuario: Usuario;
  /** Se a aba Rede está visível agora. Só restaura a rolagem da Rede
   * quando `true` — nunca mexe na rolagem de outra aba (req 2). */
  active?: boolean;
  /** Simula o teclado abrindo — repassado até a página, que esconde a BottomNav. */
  onChatFocusChange?: (focused: boolean) => void;
}

export function RedeTab({ usuario, active = true, onChatFocusChange }: Props) {
  const toast = useToast();

  // ── Semente do cache (síncrona, 1x por conta) ──
  // Lida no 1º render pra que os inicializadores de estado abaixo já
  // nasçam preenchidos quando há hit — sem skeleton no remount do PIN nem
  // no cold start (aí a semente vem do localStorage).
  const sementeRef = useRef<{
    userId: string;
    feed: { posts: FeedPost[]; hasMore: boolean } | null;
    perfil: PerfilCache | null;
    amigas: AmigasCache | null;
    conversas: ConversaResumo[] | null;
    notificacoes: Notificacao[] | null;
  } | null>(null);

  if (sementeRef.current === null || sementeRef.current.userId !== usuario.id) {
    redeCache.vincularUsuario(usuario.id);
    let feedMem = redeCache.lerFeed(usuario.id);
    if (!feedMem) {
      const persistido = redeCachePersist.carregar(usuario.id);
      if (persistido) {
        if (persistido.feed.length > 0) {
          const hasMore = persistido.feed.length >= FEED_PAGE_SIZE;
          // sobe pro cache em memória pra próximos remounts nesta sessão
          redeCache.escreverFeed(usuario.id, persistido.feed, hasMore);
          feedMem = { posts: persistido.feed, hasMore, stale: true };
        }
        if (persistido.perfil && !redeCache.ler(usuario.id, "perfil")) {
          redeCache.escrever<PerfilCache>(usuario.id, "perfil", {
            perfil: persistido.perfil,
            liveLinks: [],
            wishlistItems: [],
            clientes: [],
          });
        }
      }
    }
    sementeRef.current = {
      userId: usuario.id,
      feed: feedMem ? { posts: feedMem.posts, hasMore: feedMem.hasMore } : null,
      perfil: redeCache.ler<PerfilCache>(usuario.id, "perfil")?.data ?? null,
      amigas: redeCache.ler<AmigasCache>(usuario.id, "amigas")?.data ?? null,
      conversas:
        redeCache.ler<ConversaResumo[]>(usuario.id, "conversas")?.data ?? null,
      notificacoes:
        redeCache.ler<Notificacao[]>(usuario.id, "notificacoes")?.data ?? null,
    };
  }
  const semente = sementeRef.current;

  // TEMP-TIMING (remover junto com as demais marcas "TEMP-TIMING" após o
  // reteste do bug "SkeletonList ao voltar do 2º plano" -- ver handoff).
  useEffect(() => {
    console.info(
      `[rede-timing] RedeTab mount · sessãoJs=${redeCache.idSessaoJs}` +
        ` semente.feed=${semente.feed ? `${semente.feed.posts.length} posts` : "vazia"}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Offline / reconexão ──
  // `online` (navigator.onLine): a lista já carregada segue navegável
  // offline (só leitura); envio/escrita ficam desabilitados nos
  // componentes que recebem a prop `offline` (Conversas/Chat/Notificações).
  // `reconexaoKey` faz bump a cada evento `online` (só dispara na transição
  // offline->online) e entra nas deps dos effects de busca abaixo: eles
  // re-rodam como revalidação em 2º plano -- sem skeleton (só ligam
  // `setLoading(false)`), reconciliando com o que já está em tela, então
  // conteúdo/scroll/slide ficam intactos. Uma requisição por recurso por
  // reconexão. Declarado aqui em cima porque os effects mais acima
  // dependem dele.
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [reconexaoKey, setReconexaoKey] = useState(0);
  useEffect(() => {
    function goOnline() {
      setOnline(true);
      setReconexaoKey((k) => k + 1);
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Perfil real + LiveLinks ──
  const [perfil, setPerfil] = useState<Perfil | null>(
    () => semente.perfil?.perfil ?? null
  );
  const [liveLinks, setLiveLinks] = useState<LiveLink[]>(
    () => semente.perfil?.liveLinks ?? []
  );
  const [liveLinkFormOpen, setLiveLinkFormOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [avatarOptionsOpen, setAvatarOptionsOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  // Perfis reais de outras autoras, buscados sob demanda ao abrir o perfil
  // público de alguém a partir de um post/comentário real (ver openAutor).
  const [otherProfiles, setOtherProfiles] = useState<
    Record<
      string,
      { nome: string; bio: string; cor: string; fotoUrl: string | null }
    >
  >({});
  const [perfilError, setPerfilError] = useState(false);
  const [otherProfileLoading, setOtherProfileLoading] = useState(false);
  const [otherProfileError, setOtherProfileError] = useState(false);

  // Existir em rede_perfis é o opt-in de entrar na Rede -- quem chegou até
  // aqui já passou pelo gate, então cria silenciosamente na primeira visita
  // (nome da conta, cor aleatória) em vez de pedir preenchimento antes de
  // ver o Feed.
  useEffect(() => {
    let ativo = true;
    const ep = redeCache.epocaAtual();
    const temSemente = semente.perfil != null;
    (async () => {
      let p = await buscarPerfil(supabase, usuario.id);
      if (!p) {
        p = await criarPerfil(supabase, {
          nomeExibicao: usuario.nome,
          corAvatar: corAvatarAleatoria(),
        });
      }
      if (!ativo || !epocaValida(ep)) return;
      setPerfil(p);
      const [links, wishlist, clientesData] = await Promise.all([
        listarLiveLinks(supabase, usuario.id),
        listarWishlistItems(supabase, usuario.id),
        listarClientes(supabase, usuario.id),
      ]);
      if (!ativo || !epocaValida(ep)) return;
      setLiveLinks(links);
      setWishlistItems(wishlist);
      setClientes(clientesData);
      redeCache.escrever<PerfilCache>(
        usuario.id,
        "perfil",
        {
          perfil: p,
          liveLinks: links,
          wishlistItems: wishlist,
          clientes: clientesData,
        },
        ep
      );
      redeCachePersist.salvar(usuario.id, {
        feed: feedRef.current,
        perfil: p,
      });
    })().catch((e) => {
      console.error("[RedeTab perfil]", e);
      // Com perfil cacheado em tela, uma falha de rede não vira erro duro.
      if (!temSemente) {
        toast.error("Não foi possível carregar seu perfil da Rede.");
        setPerfilError(true);
      }
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id, reconexaoKey]);

  // ── Navegação: pilha local, sem 2ª barra de navegação (o Feed é a base) ──
  const [stack, setStack] = useState<RedeScreen[]>([{ type: "feed" }]);
  const screen = stack[stack.length - 1];
  const push = (s: RedeScreen) => setStack((prev) => [...prev, s]);
  const pop = () =>
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  // ── Feed real (paginado, issue do escopo de fotos -- listarFeed nunca
  // buscava mais que 1 página do feed inteiro) ──
  const [posts, setPosts] = useState<FeedPost[]>(
    () => semente.feed?.posts ?? []
  );
  // Só mostra skeleton em cache miss de verdade (req: com cache, sem
  // skeleton). Com semente, a busca abaixo vira refresh em 2º plano.
  const [feedLoading, setFeedLoading] = useState(() => semente.feed === null);
  const [feedError, setFeedError] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(
    () => semente.feed?.hasMore ?? true
  );
  const feedHasMoreRef = useRef(feedHasMore);
  feedHasMoreRef.current = feedHasMore;
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  // Filtro Para você / Amigas -- lembrado entre remounts (o remount do PIN
  // não deve jogar a pessoa de volta pra "Para você").
  const [segmento, setSegmento] = useState<"paraVoce" | "amigas">(() =>
    redeCache.segmentoLembrado()
  );
  const trocarSegmento = useCallback((valor: "paraVoce" | "amigas") => {
    setSegmento(valor);
    redeCache.lembrarSegmento(valor);
  }, []);

  // Espelho de `posts` pra ler dentro de callbacks/effects sem recriá-los.
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const perfilRef = useRef(perfil);
  perfilRef.current = perfil;
  // 1ª página do feed, sempre "confirmada pelo servidor" — o que a camada
  // persistida grava (nunca o estado puramente otimista).
  const feedRef = useRef<FeedPost[]>(semente.feed?.posts ?? []);
  // Curtidas otimistas ainda não confirmadas: um `listarFeed` que já estava
  // em voo quando a pessoa curtiu não pode desfazer o like (req 6).
  const likesPendentes = useRef<Set<string>>(new Set());

  // Guarda de época: uma resposta em voo capturada com `ep` no início do
  // fetch só pode tocar estado OU cache se a época não mudou. Troca de
  // conta, logout e `limparTudo` avançam a época -- então isto barra tanto
  // o write no cache (`escrever*(..., ep)`) quanto o `setState` tardio da
  // conta anterior (req 2).
  const epocaValida = useCallback(
    (ep: number) => redeCache.epocaAtual() === ep,
    []
  );

  /** setPosts + espelho no cache em memória, numa tacada (write-through). */
  const aplicarPosts = useCallback(
    (updater: (p: FeedPost[]) => FeedPost[]) => {
      setPosts(updater);
      redeCache.mutarFeed(usuario.id, updater);
    },
    [usuario.id]
  );

  /** Perfil mudou (nome/bio/avatar): atualiza o cache do perfil E os posts
   * do próprio autor no feed (que embutem nome/cor/foto), marcando o feed
   * como stale pra revalidar depois (req 6). */
  function sincronizarPerfilNoCache(novo: Perfil) {
    setPerfil(novo);
    redeCache.escrever<PerfilCache>(usuario.id, "perfil", {
      perfil: novo,
      liveLinks,
      wishlistItems,
      clientes,
    });
    const patch = (p: FeedPost): FeedPost =>
      p.autorId === usuario.id
        ? {
            ...p,
            autorNome: novo.nome_exibicao,
            autorCor: novo.cor_avatar,
            autorFotoUrl: novo.avatar_url,
          }
        : p;
    aplicarPosts((prev) => prev.map(patch));
    redeCache.invalidarFeed(usuario.id);
    feedRef.current = feedRef.current.map(patch);
    redeCachePersist.salvar(usuario.id, {
      feed: feedRef.current,
      perfil: novo,
    });
  }

  useEffect(() => {
    let ativo = true;
    const ep = redeCache.epocaAtual();
    const temSemente = semente.feed !== null;
    // TEMP-TIMING -- cobre dados+assinatura juntos: `listarFeed` já assina
    // as fotos da página 1 dentro da mesma chamada (lib/rede/feed.ts,
    // `createSignedUrls`), não são round-trips separados.
    const tFeed0 = performance.now();
    listarFeed(supabase)
      .then((data) => {
        console.info(
          `[rede-timing] feed (dados+assinatura): ${Math.round(performance.now() - tFeed0)}ms` +
            ` posts=${data.length}`
        );
        if (!ativo || !epocaValida(ep)) return;
        const conciliado = redeCache.reconciliarFeed(
          postsRef.current,
          data,
          likesPendentes.current,
          usuario.id
        );
        // Um refresh só busca a página 1 -- não dá pra concluir sozinho se
        // há mais páginas além do que já está carregado:
        //  - se a reconciliação preservou páginas mais profundas
        //    (`conciliado` maior que a página 1), mantém o `hasMore`
        //    anterior (que é autoritativo -- veio do cache em memória ou
        //    da última paginação), sem "ressuscitar" o botão depois de já
        //    ter chegado ao fim;
        //  - senão, só a página 1: deriva de `data.length` (>= PAGE_SIZE ⇒
        //    provavelmente há mais). Isto conserta o caso do cold start em
        //    que a semente do localStorage nascia com `hasMore=false` por
        //    ter sido salva com o feed ainda curto.
        const temPaginasProfundas = conciliado.length > data.length;
        const hasMore = temPaginasProfundas
          ? feedHasMoreRef.current
          : data.length >= FEED_PAGE_SIZE;
        redeCache.escreverFeed(usuario.id, conciliado, hasMore, ep);
        setPosts(conciliado);
        setFeedHasMore(hasMore);
        feedRef.current = data.filter((p) => !redeCache.estaExcluido(p.id));
        setFeedError(false);
        setFeedLoading(false);
        redeCachePersist.salvar(usuario.id, {
          feed: feedRef.current,
          perfil: perfilRef.current,
        });
      })
      .catch((e) => {
        // TEMP-TIMING
        console.info(
          `[rede-timing] feed (dados+assinatura) FALHOU: ${Math.round(performance.now() - tFeed0)}ms`
        );
        console.error("[RedeTab feed]", e);
        if (!ativo || !epocaValida(ep)) return;
        // Falha de rede com feed cacheado em tela: mantém o conteúdo
        // navegável, não vira erro duro (req 4).
        if (temSemente) {
          setFeedLoading(false);
          return;
        }
        toast.error("Não foi possível carregar o feed.");
        setFeedError(true);
        setFeedLoading(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id, reconexaoKey]);

  async function loadMorePosts() {
    if (feedLoadingMore || !feedHasMore || posts.length === 0) return;
    setFeedLoadingMore(true);
    try {
      const ep = redeCache.epocaAtual();
      const cursor = posts[posts.length - 1].criadoEm;
      const proximaPagina = await listarFeed(supabase, { antesDe: cursor });
      const hasMore = proximaPagina.length >= FEED_PAGE_SIZE;
      const juntos = [
        ...postsRef.current,
        ...proximaPagina.filter(
          (p) =>
            !postsRef.current.some((x) => x.id === p.id) &&
            !redeCache.estaExcluido(p.id)
        ),
      ];
      if (!epocaValida(ep)) return;
      redeCache.escreverFeed(usuario.id, juntos, hasMore, ep);
      setPosts(juntos);
      setFeedHasMore(hasMore);
    } catch (e) {
      console.error("[RedeTab feed carregar mais]", e);
      toast.error("Não foi possível carregar mais publicações.");
    } finally {
      setFeedLoadingMore(false);
    }
  }

  // ── Rolagem da Rede: preservada entre remounts (PIN, cold start) ──
  // O scroll de verdade é o do `window` (o <main> nunca overflow-a nesta
  // casca -- ver memória do repo). Só grava enquanto a Rede está ATIVA e no
  // Feed: nunca captura a rolagem de outra aba (req 2).
  useEffect(() => {
    if (!active || screen.type !== "feed") return;
    let raf = 0;
    const aoRolar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        redeCache.lembrarScroll(window.scrollY)
      );
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(raf);
    };
  }, [active, screen.type]);

  // Restaura a posição uma única vez por mount -- e SÓ quando a Rede está
  // visível e o conteúdo do feed já está em tela (req 1 e 2). Se a Rede
  // remontou fora de foco (o PIN destravou noutra aba), espera virar ativa.
  const scrollRestaurado = useRef(false);
  useIsomorphicLayoutEffect(() => {
    if (scrollRestaurado.current) return;
    if (!active || screen.type !== "feed") return;
    if (posts.length === 0) return; // conteúdo ainda não pronto
    const y = redeCache.scrollLembrado();
    scrollRestaurado.current = true;
    if (y != null) window.scrollTo(0, y);
  }, [active, screen.type, posts.length]);

  // ── Amigas real -- buscado sob demanda ao entrar na tela (não no mount,
  // não é o destino padrão como o Feed) ──
  const [friends, setFriends] = useState<PessoaResumo[]>(
    () => semente.amigas?.friends ?? []
  );
  const [requests, setRequests] = useState<SolicitacaoAmizade[]>(
    () => semente.amigas?.requests ?? []
  );
  const [sentRequests, setSentRequests] = useState<string[]>(
    () => semente.amigas?.sentRequests ?? []
  );
  const [sugestoes, setSugestoes] = useState<PessoaResumo[]>(
    () => semente.amigas?.sugestoes ?? []
  );
  const [amigasLoading, setAmigasLoading] = useState(
    () => semente.amigas == null
  );

  // Eager, não sob demanda: FeedScreen já mostra "N solicitações de
  // amizade" na primeira tela (pendingRequestsCount), então precisa saber
  // isso antes da usuária sequer abrir a aba Amigas.
  useEffect(() => {
    let ativo = true;
    const ep = redeCache.epocaAtual();
    Promise.all([
      listarAmigas(supabase),
      listarSolicitacoesPendentes(supabase),
      listarSolicitacoesEnviadas(supabase),
      listarSugestoes(supabase),
    ])
      .then(([amigasData, solicitacoesData, enviadasData, sugestoesData]) => {
        if (!ativo || !epocaValida(ep)) return;
        setFriends(amigasData);
        setRequests(solicitacoesData);
        setSentRequests(enviadasData);
        setSugestoes(sugestoesData);
        setAmigasLoading(false);
        redeCache.escrever<AmigasCache>(
          usuario.id,
          "amigas",
          {
            friends: amigasData,
            requests: solicitacoesData,
            sentRequests: enviadasData,
            sugestoes: sugestoesData,
          },
          ep
        );
      })
      .catch((e) => {
        console.error("[RedeTab amigas]", e);
        if (semente.amigas == null) {
          toast.error("Não foi possível carregar Amigas.");
        }
        setAmigasLoading(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id, reconexaoKey]);

  // ── Chat real ──
  const [conversations, setConversations] = useState<ConversaResumo[]>(
    () => semente.conversas ?? []
  );
  const [conversationsLoading, setConversationsLoading] = useState(
    () => semente.conversas == null
  );
  // Falha persistente (distinta de "carregou e está vazio de verdade",
  // achado P1 #6 da auditoria de T9) + chave de recarga pro botão
  // "Tentar novamente" poder re-disparar o efeito abaixo sem duplicar a
  // lógica de fetch numa função solta fora do efeito.
  const [conversationsError, setConversationsError] = useState(false);
  const [conversationsReloadKey, setConversationsReloadKey] = useState(0);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [threadReloadKey, setThreadReloadKey] = useState(0);
  // ── Issue #54: paginação de mensagens antigas ──
  const [hasMoreMessages, setHasMoreMessages] = useState<
    Record<string, boolean>
  >({});
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);

  useEffect(() => {
    let ativo = true;
    const ep = redeCache.epocaAtual();
    const temSemente = semente.conversas != null;
    setConversationsError(false);
    listarConversas(supabase)
      .then((data) => {
        if (!ativo || !epocaValida(ep)) return;
        setConversations(data);
        setConversationsLoading(false);
        redeCache.escrever<ConversaResumo[]>(usuario.id, "conversas", data, ep);
      })
      .catch((e) => {
        console.error("[RedeTab conversas]", e);
        if (!temSemente) {
          toast.error("Não foi possível carregar as conversas.");
          setConversationsError(true);
        }
        setConversationsLoading(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id, conversationsReloadKey, reconexaoKey]);

  function retryLoadConversations() {
    setConversationsLoading(true);
    setConversationsReloadKey((k) => k + 1);
  }

  const abertaConversaId =
    screen.type === "chatThread" ? screen.conversationId : null;

  useEffect(() => {
    if (!abertaConversaId) return;
    const conversaId = abertaConversaId;
    let ativo = true;
    let canal: Awaited<ReturnType<typeof assinarMensagensConversa>> | null =
      null;
    setThreadLoading(true);
    setThreadError(false);

    (async () => {
      const data = await listarMensagens(supabase, conversaId);
      if (!ativo) return;
      setMessages((prev) => ({ ...prev, [conversaId]: data }));
      setHasMoreMessages((prev) => ({
        ...prev,
        [conversaId]: data.length === MENSAGENS_PAGE_SIZE,
      }));
      setThreadLoading(false);

      const naoLidas = data.filter((m) => !m.deMim && !m.lidaEm);
      if (naoLidas.length > 0) {
        await Promise.all(
          naoLidas.map((m) =>
            marcarMensagemComoLida(supabase, {
              conversaId,
              mensagemId: m.id,
            })
          )
        );
        if (!ativo) return;
        setConversations((prev) =>
          prev.map((c) => (c.id === conversaId ? { ...c, naoLidas: 0 } : c))
        );
      }

      const canalAssinado = await assinarMensagensConversa(supabase, {
        conversaId,
        onMensagem: (nova) => {
          if (!ativo) return;
          setMessages((prev) => ({
            ...prev,
            [conversaId]: reconcileConfirmedMessage(prev[conversaId] ?? [], {
              id: nova.id,
              autorId: nova.autor_id,
              texto: nova.texto,
              criadoEm: nova.criado_em,
              lidaEm: nova.lida_em,
              deMim: nova.autor_id === usuario.id,
            }),
          }));
          const deOutraPessoa = nova.autor_id !== usuario.id;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversaId
                ? {
                    ...c,
                    ultimaMensagem: nova.texto,
                    ultimaMensagemEm: nova.criado_em,
                    naoLidas: deOutraPessoa ? 0 : c.naoLidas,
                  }
                : c
            )
          );
          // A conversa já está aberta = já está sendo lida ao vivo.
          if (deOutraPessoa) {
            marcarMensagemComoLida(supabase, {
              conversaId,
              mensagemId: nova.id,
            }).catch((e) => console.error("[RedeTab marcar lida]", e));
          }
        },
      });

      // Trocou de conversa (ou desmontou) enquanto a assinatura ainda
      // estava em andamento -- o cleanup abaixo já rodou sem `canal`
      // atribuído, então sem isto o canal ficava vazado (nunca removido,
      // continuando a atualizar estado/marcar como lida em segundo plano).
      if (!ativo) {
        void supabase.removeChannel(canalAssinado);
        return;
      }
      canal = canalAssinado;
    })().catch((e) => {
      console.error("[RedeTab thread]", e);
      toast.error("Não foi possível carregar a conversa.");
      setThreadError(true);
      setThreadLoading(false);
    });

    return () => {
      ativo = false;
      if (canal) void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abertaConversaId, threadReloadKey]);

  function retryLoadThread() {
    setThreadLoading(true);
    setThreadReloadKey((k) => k + 1);
  }

  // Issue #54: busca a página anterior ao cursor da mensagem mais antiga
  // já carregada e a prependa -- ChatThreadScreen dispara isto ao rolar
  // pro topo, e ajusta scrollTop sozinho pra tela não "pular".
  async function loadMoreMessages() {
    if (!abertaConversaId || loadingMoreMessages) return;
    const conversaId = abertaConversaId;
    const maisAntiga = (messages[conversaId] ?? [])[0];
    if (!maisAntiga) return;

    setLoadingMoreMessages(true);
    try {
      const pagina = await listarMensagens(supabase, conversaId, {
        antesDe: maisAntiga.criadoEm,
      });
      setMessages((prev) => ({
        ...prev,
        [conversaId]: [...pagina, ...(prev[conversaId] ?? [])],
      }));
      setHasMoreMessages((prev) => ({
        ...prev,
        [conversaId]: pagina.length === MENSAGENS_PAGE_SIZE,
      }));
    } catch (e) {
      console.error("[RedeTab carregar mais mensagens]", e);
      toast.error("Não foi possível carregar mensagens antigas.");
    } finally {
      setLoadingMoreMessages(false);
    }
  }

  // ── Notificações real -- eager, o sino no header mostra a contagem já
  // na primeira tela (mesmo motivo de Amigas ser eager, ver acima) ──
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>(
    () => semente.notificacoes ?? []
  );
  const [notificacoesLoading, setNotificacoesLoading] = useState(
    () => semente.notificacoes == null
  );
  const [notificacoesError, setNotificacoesError] = useState(false);
  const [notificacoesReloadKey, setNotificacoesReloadKey] = useState(0);

  useEffect(() => {
    let ativo = true;
    const ep = redeCache.epocaAtual();
    const temSemente = semente.notificacoes != null;
    setNotificacoesError(false);
    listarNotificacoes(supabase)
      .then((data) => {
        if (!ativo || !epocaValida(ep)) return;
        setNotificacoes(data);
        setNotificacoesLoading(false);
        redeCache.escrever<Notificacao[]>(usuario.id, "notificacoes", data, ep);
      })
      .catch((e) => {
        console.error("[RedeTab notificacoes]", e);
        if (!temSemente) {
          toast.error("Não foi possível carregar as notificações.");
          setNotificacoesError(true);
        }
        setNotificacoesLoading(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id, notificacoesReloadKey, reconexaoKey]);

  function retryLoadNotificacoes() {
    setNotificacoesLoading(true);
    setNotificacoesReloadKey((k) => k + 1);
  }

  // ── Wishlist e Clientes reais (issue #64 -- antes eram mock local) ──
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(
    () => semente.perfil?.wishlistItems ?? []
  );
  const [clientes, setClientes] = useState<Cliente[]>(
    () => semente.perfil?.clientes ?? []
  );
  const [defaultPrivacidade, setDefaultPrivacidade] =
    useState<Privacidade>("amigas");

  // ── Sheets ──
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [menuPost, setMenuPost] = useState<FeedPost | null>(null);
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);
  const [deleteConfirmPost, setDeleteConfirmPost] = useState<FeedPost | null>(
    null
  );
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [shareToConvoPost, setShareToConvoPost] = useState<FeedPost | null>(
    null
  );
  const [wishlistFormOpen, setWishlistFormOpen] = useState(false);
  const [editingWishlist, setEditingWishlist] = useState<WishlistItem | null>(
    null
  );
  const [clienteDetail, setClienteDetail] = useState<Cliente | null>(null);
  const [clienteFormOpen, setClienteFormOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deleteConfirmWishlist, setDeleteConfirmWishlist] =
    useState<WishlistItem | null>(null);
  const [deleteConfirmCliente, setDeleteConfirmCliente] =
    useState<Cliente | null>(null);
  const [editingLiveLink, setEditingLiveLink] = useState<LiveLink | null>(null);
  // Alvo da denúncia em andamento -- também é aberto a partir do "..." de
  // um comentário e do "..." de uma conversa (aí denuncia a pessoa, não
  // uma mensagem específica -- mais simples e igualmente acionável).
  const [reportTarget, setReportTarget] = useState<{
    tipo: "post" | "comentario" | "usuario";
    id: string;
  } | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  // Confirmação antes de bloquear a partir do menu da conversa -- achado
  // de produto P1 #4 da auditoria de T9: "Bloquear" executava direto num
  // só toque, diferente do fluxo já confirmado de PerfilPublicoScreen, e
  // agravado por bloqueio ainda ser irreversível pelo app (T8, P0 #2).
  // Mesmo padrão de segundo OptionsSheet que PerfilPublicoScreen já usa.
  const [chatBlockConfirm, setChatBlockConfirm] = useState<{
    userId: string;
    nome: string;
  } | null>(null);
  // Issue #55: mesmo padrão de confirmação de "Bloquear" acima -- excluir
  // conversa também some sem aviso, não deveria disparar num só toque.
  const [chatDeleteConfirm, setChatDeleteConfirm] = useState<{
    conversaId: string;
    nome: string;
  } | null>(null);

  // Comentários do post atualmente aberto no CommentsSheet -- buscados sob
  // demanda (rede_posts não guarda a lista, só existe agregada aqui).
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    if (!commentsPostId) {
      setComments([]);
      return;
    }
    let ativo = true;
    setCommentsLoading(true);
    listarComentarios(supabase, commentsPostId)
      .then((data) => {
        if (!ativo) return;
        setComments(data);
        setCommentsLoading(false);
      })
      .catch((e) => {
        console.error("[RedeTab comentarios]", e);
        toast.error("Não foi possível carregar os comentários.");
        setCommentsLoading(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsPostId]);

  const unreadChats = conversations.reduce((s, c) => s + c.naoLidas, 0);
  const unreadNotifs = notificacoes.filter((n) => !n.lida).length;

  // ── Posts ──
  const alternarCurtidaLocal = (id: string) => (prev: FeedPost[]) =>
    prev.map((p) =>
      p.id === id
        ? {
            ...p,
            curtidoPorMim: !p.curtidoPorMim,
            curtidas: p.curtidas + (p.curtidoPorMim ? -1 : 1),
          }
        : p
    );

  async function toggleLike(id: string) {
    // Marca a curtida como pendente: um `listarFeed` que já estava em voo
    // não pode desfazer esse like ao resolver depois (req 6). Ver
    // `reconciliarFeed`.
    likesPendentes.current.add(id);
    aplicarPosts(alternarCurtidaLocal(id));
    try {
      await alternarCurtida(supabase, { postId: id });
    } catch (e) {
      console.error("[RedeTab curtida]", e);
      // Reverte a atualização otimista se a chamada real falhar.
      aplicarPosts(alternarCurtidaLocal(id));
      toast.error("Não foi possível curtir a publicação.");
    } finally {
      likesPendentes.current.delete(id);
    }
  }

  async function addComment(postId: string, texto: string) {
    try {
      await criarComentario(supabase, { postId, texto });
      const atualizados = await listarComentarios(supabase, postId);
      setComments(atualizados);
      aplicarPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comentariosCount: atualizados.length } : p
        )
      );
      toast.success("Comentário publicado!");
    } catch (e) {
      console.error("[RedeTab comentario]", e);
      toast.error("Não foi possível publicar o comentário.");
    }
  }

  // `criarPost` devolve a linha crua de `rede_posts` + as fotos já com URL
  // assinada -- monta o FeedPost localmente com o que já se sabe do
  // próprio perfil, sem round-trip extra.
  function feedPostFromCreated(
    created: {
      id: string;
      autor_id: string;
      categoria: Categoria;
      texto: string;
      criado_em: string;
      atualizado_em: string;
    },
    fotos: FotoPost[] = []
  ): FeedPost {
    return {
      id: created.id,
      autorId: created.autor_id,
      autorNome: perfil?.nome_exibicao ?? usuario.nome,
      autorCor: perfil?.cor_avatar ?? "var(--accent)",
      autorFotoUrl: perfil?.avatar_url ?? null,
      categoria: created.categoria,
      texto: created.texto,
      criadoEm: created.criado_em,
      atualizadoEm: created.atualizado_em,
      curtidas: 0,
      curtidoPorMim: false,
      comentariosCount: 0,
      fotos,
    };
  }

  async function handlePublish(data: {
    texto: string;
    categoria: Categoria;
    fotos?: FotoParaUpload[];
  }) {
    try {
      const { post, fotos } = await criarPost(supabase, data);
      const novo = feedPostFromCreated(post, fotos);
      aplicarPosts((prev) => [novo, ...prev]);
      feedRef.current = [novo, ...feedRef.current];
      redeCachePersist.salvar(usuario.id, {
        feed: feedRef.current,
        perfil: perfilRef.current,
      });
      toast.success("Publicação enviada!");
    } catch (e) {
      console.error("[RedeTab publicar]", e);
      const fotoFalhou =
        e instanceof Error && /foto|imagem|JPEG|px|KB/i.test(e.message);
      toast.error(
        fotoFalhou
          ? `Não foi possível publicar: ${(e as Error).message}`
          : "Não foi possível publicar."
      );
    }
  }

  async function saveEditedPost(
    postId: string,
    data: { texto: string; categoria: Categoria }
  ) {
    try {
      const updated = await atualizarPost(supabase, { postId, ...data });
      aplicarPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                texto: updated.texto,
                categoria: updated.categoria,
                atualizadoEm: updated.atualizado_em,
              }
            : p
        )
      );
      toast.success("Publicação atualizada!");
    } catch (e) {
      console.error("[RedeTab editar post]", e);
      toast.error("Não foi possível atualizar a publicação.");
    }
  }

  async function deletePost(postId: string) {
    try {
      await excluirPost(supabase, { postId });
      // Tomba o id: um `listarFeed` em voo não ressuscita o post (req 6).
      redeCache.marcarExcluido(postId);
      aplicarPosts((prev) => prev.filter((p) => p.id !== postId));
      feedRef.current = feedRef.current.filter((p) => p.id !== postId);
      redeCachePersist.salvar(usuario.id, {
        feed: feedRef.current,
        perfil: perfilRef.current,
      });
      setDeleteConfirmPost(null);
      toast.success("Publicação excluída");
    } catch (e) {
      console.error("[RedeTab excluir post]", e);
      toast.error("Não foi possível excluir a publicação.");
    }
  }

  // URLs assinadas (miniatura E principal) expiram em 5min (lib/rede/feed.ts)
  // -- chamado pelo FeedFotos quando uma <img> falha ao carregar, pra renovar
  // sem re-buscar o feed. `path` pode ser o da miniatura (`thumbPath`) ou o da
  // principal (`path`): atualiza o campo certo em qualquer post que contenha
  // essa foto -- meusPosts/perfil público derivam de `posts` por filter, então
  // refletem sozinhos.
  async function renovarFotoUrl(path: string): Promise<string | null> {
    const novaUrl = await renovarUrlFoto(supabase, path);
    if (novaUrl) {
      // Espelha no cache em memória (a camada persistida nunca guarda essas
      // URLs assinadas -- ver redeCachePersist).
      aplicarPosts((prev) =>
        prev.map((p) => ({
          ...p,
          fotos: p.fotos.map((f) => {
            if (f.thumbPath === path) return { ...f, thumbUrl: novaUrl };
            if (f.path === path) return { ...f, url: novaUrl };
            return f;
          }),
        }))
      );
    }
    return novaUrl;
  }

  async function submitReport(motivo: DenunciaMotivo) {
    if (!reportTarget) return;
    try {
      await criarDenuncia(supabase, {
        alvoTipo: reportTarget.tipo,
        alvoId: reportTarget.id,
        motivo,
      });
      toast.success("Denúncia enviada, obrigada");
    } catch (e) {
      console.error("[RedeTab denuncia]", e);
      toast.error("Não foi possível enviar a denúncia.");
    } finally {
      setReportTarget(null);
    }
  }

  // Perfil real de outra autora (post/comentário), buscado sob demanda e
  // cacheado -- se não existir (ex.: id ainda mockado de Busca/Descobrir,
  // que não são reais até a ticket 11), buildProfile cai no mock abaixo.
  function openAutor(autorId: string) {
    push({ type: "perfilPublico", userId: autorId });
    setOtherProfileError(false);
    if (autorId === usuario.id || otherProfiles[autorId]) {
      setOtherProfileLoading(false);
      return;
    }
    setOtherProfileLoading(true);
    buscarPerfil(supabase, autorId)
      .then((p) => {
        setOtherProfileLoading(false);
        if (!p) return;
        setOtherProfiles((prev) => ({
          ...prev,
          [autorId]: {
            nome: p.nome_exibicao,
            bio: p.bio ?? "",
            cor: p.cor_avatar,
            fotoUrl: p.avatar_url,
          },
        }));
      })
      .catch((e) => {
        console.error("[RedeTab perfil autor]", e);
        setOtherProfileError(true);
        setOtherProfileLoading(false);
      });
  }

  // ── Amigas ──
  async function acceptRequest(req: SolicitacaoAmizade) {
    try {
      await aceitarPedidoAmizade(supabase, { amizadeId: req.id });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      setFriends((prev) => [...prev, req.pessoa]);
      toast.success("Agora vocês são amigas!");
    } catch (e) {
      console.error("[RedeTab aceitar pedido]", e);
      toast.error("Não foi possível aceitar o pedido.");
    }
  }
  async function declineRequest(id: string) {
    try {
      await recusarPedidoAmizade(supabase, { amizadeId: id });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("[RedeTab recusar pedido]", e);
      toast.error("Não foi possível recusar o pedido.");
    }
  }
  async function sendRequest(userId: string) {
    try {
      await enviarPedidoAmizade(supabase, { destinatarioId: userId });
      setSentRequests((prev) => [...prev, userId]);
      toast.success("Solicitação enviada!");
    } catch (e) {
      console.error("[RedeTab enviar pedido]", e);
      toast.error("Não foi possível enviar a solicitação.");
    }
  }
  async function removeFriend(userId: string) {
    try {
      await removerAmizade(supabase, { outroUserId: userId });
      setFriends((prev) => prev.filter((f) => f.id !== userId));
      toast.success("Amiga removida");
    } catch (e) {
      console.error("[RedeTab remover amiga]", e);
      toast.error("Não foi possível remover a amiga.");
    }
  }
  async function blockUser(userId: string) {
    try {
      await bloquearUsuario(supabase, { bloqueadoId: userId });
      setFriends((prev) => prev.filter((f) => f.id !== userId));
      setRequests((prev) => prev.filter((r) => r.pessoa.id !== userId));
      setSugestoes((prev) => prev.filter((s) => s.id !== userId));
      setSentRequests((prev) => prev.filter((id) => id !== userId));
      setConversations((prev) => prev.filter((c) => c.outroUserId !== userId));
      toast.success("Usuária bloqueada");
    } catch (e) {
      console.error("[RedeTab bloquear]", e);
      toast.error("Não foi possível bloquear.");
    }
  }

  // Issue #55: "excluir conversa" esconde só do meu lado -- a outra
  // pessoa continua vendo tudo normalmente, e a conversa reaparece na
  // minha lista sozinha se ela mandar mensagem depois.
  async function hideConversation(conversaId: string) {
    try {
      await ocultarConversa(supabase, { conversaId });
      setConversations((prev) => prev.filter((c) => c.id !== conversaId));
      if (abertaConversaId === conversaId) {
        pop();
      }
      toast.success("Conversa excluída");
    } catch (e) {
      console.error("[RedeTab excluir conversa]", e);
      toast.error("Não foi possível excluir a conversa.");
    }
  }

  // ── Pessoas bloqueadas (T8, P0 -- bloquear era irreversível pelo app até
  // este ticket) -- carregado sob demanda ao abrir a tela, não no mount,
  // mesmo padrão de Amigas/Chat serem eager só por serem destinos
  // frequentes; bloqueios são raros o bastante pra não justificar isso. ──
  const [bloqueados, setBloqueados] = useState<PessoaResumo[]>([]);
  const [bloqueadosLoading, setBloqueadosLoading] = useState(true);
  const [bloqueadosError, setBloqueadosError] = useState(false);

  function openBloqueados() {
    push({ type: "bloqueados" });
    setBloqueadosLoading(true);
    setBloqueadosError(false);
    listarBloqueadosComNome(supabase)
      .then((data) => {
        setBloqueados(data);
        setBloqueadosLoading(false);
      })
      .catch((e) => {
        console.error("[RedeTab bloqueados]", e);
        setBloqueadosError(true);
        setBloqueadosLoading(false);
      });
  }

  async function unblockUser(userId: string) {
    try {
      await desbloquearUsuario(supabase, { bloqueadoId: userId });
      setBloqueados((prev) => prev.filter((b) => b.id !== userId));
      toast.success("Usuária desbloqueada");
    } catch (e) {
      console.error("[RedeTab desbloquear]", e);
      toast.error("Não foi possível desbloquear.");
    }
  }

  // ── Notificações ──
  // Curtida/comentário/pedido de amizade não têm leitura por item (só um
  // cursor único no perfil, ver lib/rede/notificacoes.ts) -- clicar navega
  // pro destino; mensagem some sozinha quando a conversa é aberta (leitura
  // real de mensagem já existente, ticket 12), então só marca localmente
  // pra feedback imediato do sino.
  function openNotificacao(n: Notificacao) {
    if (n.tipo === "mensagem") {
      setNotificacoes((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x))
      );
    }
    switch (n.destino.tipo) {
      case "post":
        setCommentsPostId(n.destino.postId);
        break;
      case "perfil":
        openAutor(n.destino.userId);
        break;
      case "conversa":
        openChatThread(n.destino.conversaId);
        break;
    }
  }
  async function markAllNotifsRead() {
    const anterior = notificacoes;
    setNotificacoes((prev) =>
      prev.map((n) => (n.tipo === "mensagem" ? n : { ...n, lida: true }))
    );
    try {
      await marcarNotificacoesVistas(supabase);
    } catch (e) {
      console.error("[RedeTab marcar notificações vistas]", e);
      toast.error("Não foi possível marcar as notificações como lidas.");
      // Desfaz o otimismo -- sem isto, o sino mentia "tudo lido" mesmo com
      // o cursor real não avançado no backend, e só se corrigia sozinho
      // (sem explicação) no próximo refetch.
      setNotificacoes(anterior);
    }
  }

  // ── Chat ──
  function openChatThread(conversationId: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, naoLidas: 0 } : c))
    );
    push({ type: "chatThread", conversationId });
  }
  async function openChatWithUser(userId: string) {
    const existing = conversations.find((c) => c.outroUserId === userId);
    if (existing) {
      openChatThread(existing.id);
      return;
    }
    try {
      const conversaId = await abrirConversa1a1(supabase, {
        outroUserId: userId,
      });
      const perfilOutro = await buscarPerfil(supabase, userId);
      const nova: ConversaResumo = {
        id: conversaId,
        outroUserId: userId,
        outroNome: perfilOutro?.nome_exibicao ?? "Usuária",
        outroCor: perfilOutro?.cor_avatar ?? "var(--accent)",
        outroFotoUrl: perfilOutro?.avatar_url ?? null,
        ultimaMensagem: "",
        ultimaMensagemEm: null,
        naoLidas: 0,
      };
      setConversations((prev) => [nova, ...prev]);
      push({ type: "chatThread", conversationId: conversaId });
    } catch (e) {
      console.error("[RedeTab abrir conversa]", e);
      toast.error("Não foi possível abrir a conversa.");
    }
  }

  function mensagemFromRow(row: {
    id: string;
    autor_id: string;
    texto: string;
    criado_em: string;
    lida_em: string | null;
  }): ChatMessage {
    return {
      id: row.id,
      autorId: row.autor_id,
      texto: row.texto,
      criadoEm: row.criado_em,
      lidaEm: row.lida_em,
      deMim: true,
    };
  }

  async function doSendMessage(
    conversationId: string,
    localId: string,
    texto: string
  ) {
    try {
      const created = await enviarMensagem(supabase, {
        conversaId: conversationId,
        texto,
      });
      const confirmada = mensagemFromRow(created);
      setMessages((prev) => ({
        ...prev,
        [conversationId]: reconcileConfirmedMessage(
          prev[conversationId] ?? [],
          confirmada,
          localId
        ),
      }));
      fetch("/api/rede/mensagens/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversaId: conversationId, texto }),
      }).catch((e) => console.error("[RedeTab notificar mensagem]", e));
    } catch (e) {
      console.error("[RedeTab enviar mensagem]", e);
      setMessages((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) =>
          m.id === localId ? { ...m, status: "error" } : m
        ),
      }));
    }
  }

  function sendMessage(conversationId: string, texto: string) {
    const id = `temp-${Date.now()}`;
    const criadoEm = new Date().toISOString();
    const otimista: ChatMessage = {
      id,
      autorId: usuario.id,
      texto,
      criadoEm,
      lidaEm: null,
      deMim: true,
      status: "sending",
    };
    setMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), otimista],
    }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, ultimaMensagem: texto, ultimaMensagemEm: criadoEm }
          : c
      )
    );
    void doSendMessage(conversationId, id, texto);
  }

  function retrySend(conversationId: string, messageId: string) {
    const msg = messages[conversationId]?.find((m) => m.id === messageId);
    if (!msg) return;
    setMessages((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] ?? []).map((m) =>
        m.id === messageId ? { ...m, status: "sending" } : m
      ),
    }));
    void doSendMessage(conversationId, messageId, msg.texto);
  }

  function sharePostToChat(conversationId: string) {
    if (!shareToConvoPost) return;
    const preview =
      shareToConvoPost.texto.length > 60
        ? `${shareToConvoPost.texto.slice(0, 60)}…`
        : shareToConvoPost.texto;
    sendMessage(conversationId, `📎 Compartilhou uma publicação: "${preview}"`);
    const convo = conversations.find((c) => c.id === conversationId);
    toast.success(
      convo
        ? `Publicação enviada para ${convo.outroNome}!`
        : "Publicação enviada!"
    );
    setShareToConvoPost(null);
    setSharePost(null);
  }

  // ── LiveLinks ──
  async function moveLiveLink(id: string, direction: "up" | "down") {
    const sorted = [...liveLinks].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex((l) => l.id === id);
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapWith]] = [
      reordered[swapWith],
      reordered[idx],
    ];
    try {
      const updated = await reordenarLiveLinks(supabase, {
        ids: reordered.map((l) => l.id),
      });
      setLiveLinks(updated);
    } catch {
      toast.error("Não foi possível reordenar os LiveLinks.");
    }
  }
  function shareProfile() {
    toast.success("Link do perfil copiado!");
  }
  async function saveLiveLink(
    data: { titulo: string; url: string },
    existing: LiveLink | null
  ) {
    try {
      if (existing) {
        const updated = await atualizarLiveLink(supabase, {
          livelinkId: existing.id,
          titulo: data.titulo,
          url: data.url,
        });
        setLiveLinks((prev) =>
          prev.map((l) => (l.id === updated.id ? updated : l))
        );
        toast.success("LiveLink atualizado!");
      } else {
        const created = await criarLiveLink(supabase, {
          titulo: data.titulo,
          url: data.url,
          ordem: liveLinks.length,
        });
        setLiveLinks((prev) => [...prev, created]);
        toast.success("LiveLink adicionado!");
      }
      setLiveLinkFormOpen(false);
      setEditingLiveLink(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível salvar o LiveLink."
      );
    }
  }
  async function deleteLiveLink(id: string) {
    try {
      await excluirLiveLink(supabase, { livelinkId: id });
      setLiveLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success("LiveLink excluído");
    } catch {
      toast.error("Não foi possível excluir o LiveLink.");
    }
  }
  async function saveProfile(data: { nomeExibicao: string; bio: string }) {
    try {
      const updated = await atualizarPerfil(supabase, {
        nomeExibicao: data.nomeExibicao,
        bio: data.bio,
      });
      sincronizarPerfilNoCache(updated);
      setProfileEditOpen(false);
      toast.success("Perfil atualizado!");
    } catch {
      toast.error("Não foi possível salvar o perfil.");
    }
  }

  async function handleAvatarFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("A imagem deve ter até 5MB.");
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${usuario.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatares")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatares").getPublicUrl(path);
      const oldPath = avatarPathFromUrl(perfil?.avatar_url);
      const updated = await atualizarPerfil(supabase, {
        avatarUrl: publicUrl,
      });
      sincronizarPerfilNoCache(updated);
      if (oldPath) {
        supabase.storage
          .from("avatares")
          .remove([oldPath])
          .catch(() => {});
      }
      toast.success("Foto atualizada!");
    } catch (e) {
      console.error("[RedeTab upload avatar]", e);
      toast.error("Não foi possível enviar a foto.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    setAvatarOptionsOpen(false);
    const oldPath = avatarPathFromUrl(perfil?.avatar_url);
    try {
      const updated = await atualizarPerfil(supabase, { avatarUrl: null });
      sincronizarPerfilNoCache(updated);
      if (oldPath) {
        await supabase.storage.from("avatares").remove([oldPath]);
      }
      toast.success("Foto removida.");
    } catch (e) {
      console.error("[RedeTab remover avatar]", e);
      toast.error("Não foi possível remover a foto.");
    }
  }

  // ── Wishlist (issue #64 -- persistência real) ──
  async function saveWishlist(
    form: {
      nome: string;
      valorAlvo: string;
      valorAtual: string;
      estado: WishlistItem["estado"];
      privacidade: Privacidade;
    },
    existing: WishlistItem | null
  ) {
    try {
      if (existing) {
        const atualizado = await atualizarWishlistItem(supabase, {
          itemId: existing.id,
          nome: form.nome,
          valorAlvo: Number(form.valorAlvo) || existing.valorAlvo,
          valorAtual: Number(form.valorAtual) || 0,
          estado: form.estado,
          privacidade: form.privacidade,
        });
        setWishlistItems((prev) =>
          prev.map((w) => (w.id === atualizado.id ? atualizado : w))
        );
        toast.success("Desejo atualizado!");
      } else {
        const criado = await criarWishlistItem(supabase, {
          nome: form.nome,
          cor: WISHLIST_PALETTE[wishlistItems.length % WISHLIST_PALETTE.length],
          valorAlvo: Number(form.valorAlvo) || 0,
          valorAtual: Number(form.valorAtual) || 0,
          estado: form.estado,
          privacidade: form.privacidade,
        });
        setWishlistItems((prev) => [criado, ...prev]);
        toast.success("Desejo adicionado!");
      }
      setWishlistFormOpen(false);
      setEditingWishlist(null);
    } catch (e) {
      console.error("[RedeTab salvar desejo]", e);
      toast.error("Não foi possível salvar o desejo.");
    }
  }
  async function deleteWishlist(id: string) {
    try {
      await excluirWishlistItem(supabase, { itemId: id });
      setWishlistItems((prev) => prev.filter((w) => w.id !== id));
      setDeleteConfirmWishlist(null);
      setWishlistFormOpen(false);
      setEditingWishlist(null);
      toast.success("Desejo excluído");
    } catch (e) {
      console.error("[RedeTab excluir desejo]", e);
      toast.error("Não foi possível excluir o desejo.");
    }
  }
  // rede_posts não tem como guardar um card de desejo embutido, então
  // compartilhar vira um post de texto normal descrevendo o progresso,
  // publicado de verdade no Feed.
  async function shareWishlistToFeed(item: WishlistItem) {
    const progresso = Math.round((item.valorAtual / item.valorAlvo) * 100);
    try {
      const { post } = await criarPost(supabase, {
        categoria: "conquista",
        texto: `Compartilhando meu progresso com "${item.nome}" — ${progresso}% da meta!`,
      });
      aplicarPosts((prev) => [feedPostFromCreated(post), ...prev]);
      setWishlistFormOpen(false);
      setEditingWishlist(null);
      toast.success("Desejo compartilhado no Feed!");
      setStack([{ type: "feed" }]);
    } catch (e) {
      console.error("[RedeTab compartilhar desejo]", e);
      toast.error("Não foi possível compartilhar no Feed.");
    }
  }

  // ── Clientes (issue #64 -- persistência real) ──
  async function saveCliente(
    form: {
      nome: string;
      telefone: string;
      status: Cliente["status"];
      etiquetas: string;
      observacoes: string;
    },
    existing: Cliente | null
  ) {
    const etiquetas = form.etiquetas
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      if (existing) {
        const atualizado = await atualizarCliente(supabase, {
          clienteId: existing.id,
          nome: form.nome,
          telefone: form.telefone,
          status: form.status,
          etiquetas,
          observacoes: form.observacoes,
        });
        setClientes((prev) =>
          prev.map((c) => (c.id === atualizado.id ? atualizado : c))
        );
        toast.success("Cliente atualizado!");
      } else {
        const criado = await criarCliente(supabase, {
          nome: form.nome,
          telefone: form.telefone,
          status: form.status,
          etiquetas,
          observacoes: form.observacoes,
        });
        setClientes((prev) => [criado, ...prev]);
        toast.success("Cliente adicionado!");
      }
      setClienteFormOpen(false);
      setEditingCliente(null);
      setClienteDetail(null);
    } catch (e) {
      console.error("[RedeTab salvar cliente]", e);
      toast.error("Não foi possível salvar o cliente.");
    }
  }
  async function deleteCliente(id: string) {
    try {
      await excluirCliente(supabase, { clienteId: id });
      setClientes((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirmCliente(null);
      setClienteDetail(null);
      toast.success("Cliente excluído");
    } catch (e) {
      console.error("[RedeTab excluir cliente]", e);
      toast.error("Não foi possível excluir o cliente.");
    }
  }

  // ── Perfil público: dados derivados ──
  function buildProfile(userId: string) {
    if (userId === usuario.id) {
      return {
        nome: perfil?.nome_exibicao ?? usuario.nome,
        handle: undefined,
        cor: perfil?.cor_avatar,
        bio: perfil?.bio ?? "",
        fotoUrl: perfil?.avatar_url ?? null,
        isMe: true,
      };
    }
    const real = otherProfiles[userId];
    if (real) {
      return {
        nome: real.nome,
        handle: undefined,
        cor: real.cor,
        bio: real.bio,
        fotoUrl: real.fotoUrl,
        isMe: false,
      };
    }
    // Fallback pro mock: cobre Busca/Descobrir, que ainda não são reais
    // (ticket 11) e apontam ids que não existem em rede_perfis.
    const u = findUser(userId);
    return {
      nome: u?.nome ?? "Usuária",
      handle: u?.handle,
      cor: u?.cor,
      bio: u?.bio ?? "",
      fotoUrl: null,
      isMe: false,
    };
  }

  const postActions = {
    onToggleLike: toggleLike,
    onComment: (p: FeedPost) => setCommentsPostId(p.id),
    onShare: (p: FeedPost) => setSharePost(p),
    onOpenMenu: (p: FeedPost) => setMenuPost(p),
    onRenovarFoto: renovarFotoUrl,
  };

  return (
    <div className="pb-4">
      {screen.type === "feed" && (
        <FeedScreen
          usuario={usuario}
          usuarioFotoUrl={perfil?.avatar_url ?? null}
          posts={posts}
          friends={friends.map((f) => f.id)}
          wishlistItems={wishlistItems}
          pendingRequestsCount={requests.length}
          unreadChats={unreadChats}
          unreadNotifs={unreadNotifs}
          loading={feedLoading}
          error={feedError}
          hasMore={feedHasMore}
          loadingMore={feedLoadingMore}
          segmento={segmento}
          onSegmentoChange={trocarSegmento}
          onLoadMore={loadMorePosts}
          onOpenSearch={() => push({ type: "busca" })}
          onOpenNotifs={() => setNotifSheetOpen(true)}
          onOpenChat={() => push({ type: "chatList" })}
          onOpenMeuEspaco={() => push({ type: "meuEspaco" })}
          onOpenAmigas={() => push({ type: "amigas" })}
          onOpenWishlist={() => push({ type: "wishlist" })}
          onOpenComposer={() => setComposerOpen(true)}
          onOpenAutor={openAutor}
          {...postActions}
        />
      )}

      {screen.type === "busca" && (
        <SearchScreen
          posts={posts}
          onBack={pop}
          onOpenAutor={openAutor}
          onOpenPost={(p) => setCommentsPostId(p.id)}
          onSearchPessoas={(q) => buscarPessoas(supabase, q)}
        />
      )}

      {screen.type === "amigas" && (
        <AmigasScreen
          loading={amigasLoading}
          friends={friends}
          requests={requests}
          sugestoes={sugestoes}
          sentRequests={sentRequests}
          onBack={pop}
          onAccept={acceptRequest}
          onDecline={declineRequest}
          onSendRequest={sendRequest}
          onRemoveFriend={removeFriend}
          onBlock={blockUser}
          onOpenChat={openChatWithUser}
          onOpenProfile={openAutor}
        />
      )}

      {screen.type === "chatList" && (
        <ChatListScreen
          loading={conversationsLoading}
          error={conversationsError}
          offline={!online}
          conversations={conversations}
          onBack={pop}
          onOpenThread={openChatThread}
          onRetryLoad={retryLoadConversations}
        />
      )}

      {screen.type === "chatThread" &&
        (() => {
          const convo = conversations.find(
            (c) => c.id === screen.conversationId
          );
          if (!convo) return null;
          return (
            <ChatThreadScreen
              conversation={convo}
              messages={messages[convo.id] ?? []}
              loading={threadLoading}
              error={threadError}
              offline={!online}
              onBack={pop}
              onOpenAutor={openAutor}
              onOpenMenu={() => setChatMenuOpen(true)}
              onSend={(texto) => sendMessage(convo.id, texto)}
              onRetry={(messageId) => retrySend(convo.id, messageId)}
              onRetryLoad={retryLoadThread}
              onComposerFocusChange={onChatFocusChange}
              hasMoreMessages={hasMoreMessages[convo.id] ?? false}
              loadingMoreMessages={loadingMoreMessages}
              onLoadMoreMessages={loadMoreMessages}
            />
          );
        })()}

      {screen.type === "meuEspaco" && (
        <MeuEspacoScreen
          nomeExibicao={perfil?.nome_exibicao ?? usuario.nome}
          bio={perfil?.bio ?? ""}
          cor={perfil?.cor_avatar ?? "var(--accent)"}
          fotoUrl={perfil?.avatar_url ?? null}
          meusPosts={posts.filter((p) => p.autorId === usuario.id)}
          liveLinks={liveLinks}
          wishlistItems={wishlistItems}
          clientesCount={clientes.length}
          defaultPrivacidade={defaultPrivacidade}
          loading={perfil === null && !perfilError}
          error={perfilError}
          onBack={pop}
          onMoveLiveLink={moveLiveLink}
          onEditLiveLink={(link) => {
            setEditingLiveLink(link);
            setLiveLinkFormOpen(true);
          }}
          onDeleteLiveLink={deleteLiveLink}
          onAddLiveLink={() => {
            setEditingLiveLink(null);
            setLiveLinkFormOpen(true);
          }}
          onEditProfile={() => setProfileEditOpen(true)}
          onEditAvatar={() => {
            if (perfil?.avatar_url) setAvatarOptionsOpen(true);
            else avatarFileInputRef.current?.click();
          }}
          onShareProfile={shareProfile}
          onOpenWishlist={() => push({ type: "wishlist" })}
          onOpenClientes={() => push({ type: "clientes" })}
          onOpenBloqueados={openBloqueados}
          onOpenPerfilPublico={() =>
            push({ type: "perfilPublico", userId: usuario.id })
          }
          onChangeDefaultPrivacidade={setDefaultPrivacidade}
          {...postActions}
        />
      )}

      {screen.type === "perfilPublico" &&
        (() => {
          const profile = buildProfile(screen.userId);
          const isFriend = profile.isMe
            ? false
            : friends.some((f) => f.id === screen.userId);
          const wishlistPublico = profile.isMe
            ? wishlistItems.filter((w) => w.privacidade === "comunidade")
            : [];
          // LiveLinks de outras pessoas ainda não têm de onde vir --
          // nenhuma ticket do mapa expõe LiveLinks de terceiros, só o
          // próprio perfil (ticket 09). Fora do escopo por enquanto.
          const livelinksExibidos = profile.isMe ? liveLinks : [];
          return (
            <PerfilPublicoScreen
              nome={profile.nome}
              handle={profile.handle}
              cor={profile.cor}
              fotoUrl={profile.fotoUrl}
              bio={profile.bio}
              isMe={profile.isMe}
              isFriend={isFriend}
              requestSent={sentRequests.includes(screen.userId)}
              liveLinks={livelinksExibidos}
              wishlistPublico={wishlistPublico}
              posts={posts.filter((p) => p.autorId === screen.userId)}
              loading={!profile.isMe && otherProfileLoading}
              error={!profile.isMe && otherProfileError}
              onBack={pop}
              onOpenChat={() => openChatWithUser(screen.userId)}
              onSendRequest={() => sendRequest(screen.userId)}
              onBlock={() => {
                blockUser(screen.userId);
                pop();
              }}
              {...postActions}
            />
          );
        })()}

      {screen.type === "wishlist" && (
        <WishlistScreen
          items={wishlistItems}
          onBack={pop}
          onAddNew={() => {
            setEditingWishlist(null);
            setWishlistFormOpen(true);
          }}
          onOpenItem={(item) => {
            setEditingWishlist(item);
            setWishlistFormOpen(true);
          }}
        />
      )}

      {screen.type === "clientes" && (
        <ClientesScreen
          clientes={clientes}
          onBack={pop}
          onAddNew={() => {
            setEditingCliente(null);
            setClienteFormOpen(true);
          }}
          onOpenCliente={setClienteDetail}
        />
      )}

      {screen.type === "bloqueados" && (
        <BlockedUsersScreen
          items={bloqueados}
          loading={bloqueadosLoading}
          error={bloqueadosError}
          onBack={pop}
          onUnblock={unblockUser}
        />
      )}

      {/* ── Sheets globais ── */}
      <PostComposer
        open={composerOpen}
        usuarioNome={usuario.nome}
        usuarioFotoUrl={perfil?.avatar_url ?? null}
        editingPost={editingPost}
        onClose={() => {
          setComposerOpen(false);
          setEditingPost(null);
        }}
        onPublish={handlePublish}
        onSaveEdit={saveEditedPost}
      />

      <CommentsSheet
        postId={commentsPostId}
        usuarioNome={usuario.nome}
        usuarioFotoUrl={perfil?.avatar_url ?? null}
        comments={comments}
        loading={commentsLoading}
        onClose={() => setCommentsPostId(null)}
        onAddComment={addComment}
        onOpenAutor={openAutor}
        onReportComment={(c) =>
          setReportTarget({ tipo: "comentario", id: c.id })
        }
      />

      <RedeNotificationsSheet
        open={notifSheetOpen}
        onClose={() => setNotifSheetOpen(false)}
        loading={notificacoesLoading}
        error={notificacoesError}
        offline={!online}
        notificacoes={notificacoes}
        onOpenNotificacao={openNotificacao}
        onMarkAllRead={markAllNotifsRead}
        onRetryLoad={retryLoadNotificacoes}
      />

      <OptionsSheet
        open={!!menuPost}
        title="Publicação"
        onClose={() => setMenuPost(null)}
        options={
          !menuPost
            ? []
            : menuPost.autorId === usuario.id
              ? [
                  {
                    key: "editar",
                    label: "Editar",
                    Icon: Pencil,
                    onSelect: () => {
                      setEditingPost(menuPost);
                      setComposerOpen(true);
                    },
                  },
                  {
                    key: "excluir",
                    label: "Excluir",
                    Icon: Trash2,
                    danger: true,
                    onSelect: () => setDeleteConfirmPost(menuPost),
                  },
                  {
                    key: "cancelar",
                    label: "Cancelar",
                    Icon: X,
                    onSelect: () => {},
                  },
                ]
              : [
                  {
                    key: "denunciar",
                    label: "Denunciar",
                    Icon: Flag,
                    danger: true,
                    onSelect: () =>
                      setReportTarget({ tipo: "post", id: menuPost.id }),
                  },
                  {
                    key: "cancelar",
                    label: "Cancelar",
                    Icon: X,
                    onSelect: () => {},
                  },
                ]
        }
      />

      <OptionsSheet
        open={chatMenuOpen}
        title="Opções da conversa"
        onClose={() => setChatMenuOpen(false)}
        options={
          screen.type !== "chatThread"
            ? []
            : (() => {
                const convo = conversations.find(
                  (c) => c.id === screen.conversationId
                );
                if (!convo) return [];
                return [
                  {
                    key: "denunciar",
                    label: "Denunciar",
                    Icon: Flag,
                    danger: true,
                    onSelect: () =>
                      setReportTarget({
                        tipo: "usuario",
                        id: convo.outroUserId,
                      }),
                  },
                  {
                    key: "bloquear",
                    label: "Bloquear",
                    Icon: Ban,
                    danger: true,
                    onSelect: () =>
                      setChatBlockConfirm({
                        userId: convo.outroUserId,
                        nome: convo.outroNome,
                      }),
                  },
                  {
                    key: "excluir",
                    label: "Excluir conversa",
                    Icon: Trash2,
                    danger: true,
                    onSelect: () =>
                      setChatDeleteConfirm({
                        conversaId: convo.id,
                        nome: convo.outroNome,
                      }),
                  },
                  {
                    key: "cancelar",
                    label: "Cancelar",
                    Icon: X,
                    onSelect: () => {},
                  },
                ];
              })()
        }
      />

      <OptionsSheet
        open={!!chatDeleteConfirm}
        title={
          chatDeleteConfirm
            ? `Excluir conversa com ${chatDeleteConfirm.nome}?`
            : "Excluir conversa?"
        }
        onClose={() => setChatDeleteConfirm(null)}
        options={[
          {
            key: "confirmar",
            label: "Sim, excluir",
            Icon: Trash2,
            danger: true,
            onSelect: () => {
              if (!chatDeleteConfirm) return;
              hideConversation(chatDeleteConfirm.conversaId);
            },
          },
          {
            key: "cancelar",
            label: "Cancelar",
            Icon: X,
            onSelect: () => {},
          },
        ]}
      />

      <OptionsSheet
        open={!!chatBlockConfirm}
        title={
          chatBlockConfirm ? `Bloquear ${chatBlockConfirm.nome}?` : "Bloquear?"
        }
        onClose={() => setChatBlockConfirm(null)}
        options={[
          {
            key: "confirmar",
            label: "Sim, bloquear",
            Icon: Ban,
            danger: true,
            onSelect: () => {
              if (!chatBlockConfirm) return;
              blockUser(chatBlockConfirm.userId);
              pop();
            },
          },
          {
            key: "cancelar",
            label: "Cancelar",
            Icon: X,
            onSelect: () => {},
          },
        ]}
      />

      <OptionsSheet
        open={!!reportTarget}
        title="Motivo da denúncia"
        onClose={() => setReportTarget(null)}
        options={[
          {
            key: "spam",
            label: "Spam",
            Icon: Flag,
            danger: true,
            onSelect: () => submitReport("spam"),
          },
          {
            key: "assedio",
            label: "Assédio",
            Icon: Flag,
            danger: true,
            onSelect: () => submitReport("assedio"),
          },
          {
            key: "conteudo_impropio",
            label: "Conteúdo impróprio",
            Icon: Flag,
            danger: true,
            onSelect: () => submitReport("conteudo_impropio"),
          },
          {
            key: "outro",
            label: "Outro motivo",
            Icon: Flag,
            danger: true,
            onSelect: () => submitReport("outro"),
          },
          {
            key: "cancelar",
            label: "Cancelar",
            Icon: X,
            onSelect: () => {},
          },
        ]}
      />

      <OptionsSheet
        open={!!deleteConfirmPost}
        title="Excluir publicação?"
        onClose={() => setDeleteConfirmPost(null)}
        options={[
          {
            key: "confirmar",
            label: "Sim, excluir",
            Icon: Trash2,
            danger: true,
            onSelect: () => {
              if (deleteConfirmPost) deletePost(deleteConfirmPost.id);
            },
          },
          {
            key: "cancelar",
            label: "Cancelar",
            Icon: X,
            onSelect: () => {},
          },
        ]}
      />

      <OptionsSheet
        open={!!sharePost}
        title="Compartilhar"
        onClose={() => setSharePost(null)}
        options={[
          {
            key: "conversa",
            label: "Enviar para uma conversa",
            Icon: Send,
            onSelect: () => setShareToConvoPost(sharePost),
          },
          {
            key: "copiar",
            label: "Copiar link da publicação",
            Icon: Link2,
            onSelect: () => toast.success("Link copiado!"),
          },
        ]}
      />

      <ShareToChatSheet
        open={!!shareToConvoPost}
        conversations={conversations}
        onClose={() => setShareToConvoPost(null)}
        onSelectConversation={sharePostToChat}
      />

      <LiveLinkForm
        open={liveLinkFormOpen}
        link={editingLiveLink}
        onClose={() => {
          setLiveLinkFormOpen(false);
          setEditingLiveLink(null);
        }}
        onSave={saveLiveLink}
      />

      <ProfileEditForm
        open={profileEditOpen}
        initial={{
          nomeExibicao: perfil?.nome_exibicao ?? usuario.nome,
          bio: perfil?.bio ?? "",
        }}
        onClose={() => setProfileEditOpen(false)}
        onSave={saveProfile}
      />

      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileSelected}
      />

      <OptionsSheet
        open={avatarOptionsOpen}
        title="Foto de perfil"
        onClose={() => setAvatarOptionsOpen(false)}
        options={[
          {
            key: "trocar",
            label: avatarUploading ? "Enviando…" : "Trocar foto",
            Icon: Camera,
            onSelect: () => avatarFileInputRef.current?.click(),
          },
          {
            key: "remover",
            label: "Remover foto",
            Icon: Trash2,
            danger: true,
            onSelect: removeAvatar,
          },
          {
            key: "cancelar",
            label: "Cancelar",
            Icon: X,
            onSelect: () => {},
          },
        ]}
      />

      <WishlistForm
        open={wishlistFormOpen}
        item={editingWishlist}
        onClose={() => {
          setWishlistFormOpen(false);
          setEditingWishlist(null);
        }}
        onSave={saveWishlist}
        onShareToFeed={shareWishlistToFeed}
        onDeleteRequest={(item) => {
          setWishlistFormOpen(false);
          setDeleteConfirmWishlist(item);
        }}
      />

      <ClienteDetailSheet
        cliente={clienteDetail}
        onClose={() => setClienteDetail(null)}
        onEdit={(c) => {
          setEditingCliente(c);
          setClienteFormOpen(true);
        }}
        onDeleteRequest={(c) => {
          setClienteDetail(null);
          setDeleteConfirmCliente(c);
        }}
      />

      <ClienteForm
        open={clienteFormOpen}
        cliente={editingCliente}
        onClose={() => {
          setClienteFormOpen(false);
          setEditingCliente(null);
        }}
        onSave={saveCliente}
      />

      <OptionsSheet
        open={!!deleteConfirmWishlist}
        title="Excluir desejo?"
        onClose={() => setDeleteConfirmWishlist(null)}
        options={[
          {
            key: "confirmar",
            label: "Sim, excluir",
            Icon: Trash2,
            danger: true,
            onSelect: () => {
              if (deleteConfirmWishlist)
                deleteWishlist(deleteConfirmWishlist.id);
            },
          },
          {
            key: "cancelar",
            label: "Cancelar",
            Icon: X,
            onSelect: () => {},
          },
        ]}
      />

      <OptionsSheet
        open={!!deleteConfirmCliente}
        title="Excluir cliente?"
        onClose={() => setDeleteConfirmCliente(null)}
        options={[
          {
            key: "confirmar",
            label: "Sim, excluir",
            Icon: Trash2,
            danger: true,
            onSelect: () => {
              if (deleteConfirmCliente) deleteCliente(deleteConfirmCliente.id);
            },
          },
          {
            key: "cancelar",
            label: "Cancelar",
            Icon: X,
            onSelect: () => {},
          },
        ]}
      />
    </div>
  );
}
