"use client";

import { useEffect, useState } from "react";
import { Link2, Flag, Pencil, Trash2, Send, Share2, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { FeedScreen } from "./FeedScreen";
import { SearchScreen } from "./SearchScreen";
import { AmigasScreen } from "./AmigasScreen";
import { ChatListScreen } from "./ChatListScreen";
import { ChatThreadScreen } from "./ChatThreadScreen";
import { MeuEspacoScreen } from "./MeuEspacoScreen";
import { PerfilPublicoScreen } from "./PerfilPublicoScreen";
import { WishlistScreen } from "./WishlistScreen";
import { WishlistForm, WISHLIST_PALETTE } from "./WishlistForm";
import { ClientesScreen } from "./ClientesScreen";
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
import {
  CONVERSATIONS,
  MESSAGES,
  WISHLIST_ITEMS,
  CLIENTES,
  REDE_NOTIFICACOES,
  findUser,
  type Conversation,
  type RedeMessage,
  type WishlistItem,
  type Cliente,
  type RedeNotificacao,
  type Privacidade,
} from "@/lib/mockRede";
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
  listarFeed,
  criarPost,
  atualizarPost,
  excluirPost,
  listarComentarios,
  criarComentario,
  alternarCurtida,
  type FeedPost,
  type FeedComment,
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
  type SolicitacaoAmizade,
} from "@/lib/rede/social";
import type { Database } from "@/lib/database.types";
import type { Usuario } from "@/lib/types";

type Perfil = Database["public"]["Tables"]["rede_perfis"]["Row"];
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

type RedeScreen =
  | { type: "feed" }
  | { type: "busca" }
  | { type: "amigas" }
  | { type: "chatList" }
  | { type: "chatThread"; conversationId: string }
  | { type: "meuEspaco" }
  | { type: "perfilPublico"; userId: string }
  | { type: "wishlist" }
  | { type: "clientes" };

interface Props {
  usuario: Usuario;
  /** Simula o teclado abrindo — repassado até a página, que esconde a BottomNav. */
  onChatFocusChange?: (focused: boolean) => void;
}

export function RedeTab({ usuario, onChatFocusChange }: Props) {
  const toast = useToast();

  // ── Perfil real + LiveLinks ──
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [liveLinks, setLiveLinks] = useState<LiveLink[]>([]);
  const [liveLinkFormOpen, setLiveLinkFormOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  // Perfis reais de outras autoras, buscados sob demanda ao abrir o perfil
  // público de alguém a partir de um post/comentário real (ver openAutor).
  const [otherProfiles, setOtherProfiles] = useState<
    Record<string, { nome: string; bio: string; cor: string }>
  >({});

  // Existir em rede_perfis é o opt-in de entrar na Rede -- quem chegou até
  // aqui já passou pelo gate, então cria silenciosamente na primeira visita
  // (nome da conta, cor aleatória) em vez de pedir preenchimento antes de
  // ver o Feed.
  useEffect(() => {
    let ativo = true;
    (async () => {
      let p = await buscarPerfil(supabase, usuario.id);
      if (!p) {
        p = await criarPerfil(supabase, {
          nomeExibicao: usuario.nome,
          corAvatar: corAvatarAleatoria(),
        });
      }
      if (!ativo) return;
      setPerfil(p);
      const links = await listarLiveLinks(supabase, usuario.id);
      if (!ativo) return;
      setLiveLinks(links);
    })().catch((e) => {
      console.error("[RedeTab perfil]", e);
      toast.error("Não foi possível carregar seu perfil da Rede.");
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id]);

  // ── Navegação: pilha local, sem 2ª barra de navegação (o Feed é a base) ──
  const [stack, setStack] = useState<RedeScreen[]>([{ type: "feed" }]);
  const screen = stack[stack.length - 1];
  const push = (s: RedeScreen) => setStack((prev) => [...prev, s]);
  const pop = () =>
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  // ── Feed real ──
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    listarFeed(supabase)
      .then((data) => {
        if (!ativo) return;
        setPosts(data);
        setFeedLoading(false);
      })
      .catch((e) => {
        console.error("[RedeTab feed]", e);
        toast.error("Não foi possível carregar o feed.");
        setFeedLoading(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Amigas real -- buscado sob demanda ao entrar na tela (não no mount,
  // não é o destino padrão como o Feed) ──
  const [friends, setFriends] = useState<PessoaResumo[]>([]);
  const [requests, setRequests] = useState<SolicitacaoAmizade[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [sugestoes, setSugestoes] = useState<PessoaResumo[]>([]);
  const [amigasLoading, setAmigasLoading] = useState(true);

  // Eager, não sob demanda: FeedScreen já mostra "N solicitações de
  // amizade" na primeira tela (pendingRequestsCount), então precisa saber
  // isso antes da usuária sequer abrir a aba Amigas.
  useEffect(() => {
    let ativo = true;
    Promise.all([
      listarAmigas(supabase),
      listarSolicitacoesPendentes(supabase),
      listarSolicitacoesEnviadas(supabase),
      listarSugestoes(supabase),
    ])
      .then(([amigasData, solicitacoesData, enviadasData, sugestoesData]) => {
        if (!ativo) return;
        setFriends(amigasData);
        setRequests(solicitacoesData);
        setSentRequests(enviadasData);
        setSugestoes(sugestoesData);
        setAmigasLoading(false);
      })
      .catch((e) => {
        console.error("[RedeTab amigas]", e);
        toast.error("Não foi possível carregar Amigas.");
        setAmigasLoading(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dados mockados, mutáveis localmente ──
  const [conversations, setConversations] =
    useState<Conversation[]>(CONVERSATIONS);
  const [messages, setMessages] =
    useState<Record<string, RedeMessage[]>>(MESSAGES);
  const [wishlistItems, setWishlistItems] =
    useState<WishlistItem[]>(WISHLIST_ITEMS);
  const [clientes, setClientes] = useState<Cliente[]>(CLIENTES);
  const [notificacoes, setNotificacoes] =
    useState<RedeNotificacao[]>(REDE_NOTIFICACOES);
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
  // Alvo da denúncia em andamento -- separado do menu de opções do post
  // porque também é aberto a partir do "..." de um comentário.
  const [reportTarget, setReportTarget] = useState<{
    tipo: "post" | "comentario";
    id: string;
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
  async function toggleLike(id: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              curtidoPorMim: !p.curtidoPorMim,
              curtidas: p.curtidas + (p.curtidoPorMim ? -1 : 1),
            }
          : p
      )
    );
    try {
      await alternarCurtida(supabase, { postId: id });
    } catch (e) {
      console.error("[RedeTab curtida]", e);
      // Reverte a atualização otimista se a chamada real falhar.
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                curtidoPorMim: !p.curtidoPorMim,
                curtidas: p.curtidas + (p.curtidoPorMim ? -1 : 1),
              }
            : p
        )
      );
      toast.error("Não foi possível curtir a publicação.");
    }
  }

  async function addComment(postId: string, texto: string) {
    try {
      await criarComentario(supabase, { postId, texto });
      const atualizados = await listarComentarios(supabase, postId);
      setComments(atualizados);
      setPosts((prev) =>
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

  // `criarPost` devolve a linha crua de `rede_posts` -- monta o FeedPost
  // localmente com o que já se sabe do próprio perfil, sem round-trip extra.
  function feedPostFromCreated(created: {
    id: string;
    autor_id: string;
    categoria: Categoria;
    texto: string;
    criado_em: string;
    atualizado_em: string;
  }): FeedPost {
    return {
      id: created.id,
      autorId: created.autor_id,
      autorNome: perfil?.nome_exibicao ?? usuario.nome,
      autorCor: perfil?.cor_avatar ?? "var(--accent)",
      categoria: created.categoria,
      texto: created.texto,
      criadoEm: created.criado_em,
      atualizadoEm: created.atualizado_em,
      curtidas: 0,
      curtidoPorMim: false,
      comentariosCount: 0,
    };
  }

  async function handlePublish(data: { texto: string; categoria: Categoria }) {
    try {
      const created = await criarPost(supabase, data);
      setPosts((prev) => [feedPostFromCreated(created), ...prev]);
      toast.success("Publicação enviada!");
    } catch (e) {
      console.error("[RedeTab publicar]", e);
      toast.error("Não foi possível publicar.");
    }
  }

  async function saveEditedPost(
    postId: string,
    data: { texto: string; categoria: Categoria }
  ) {
    try {
      const updated = await atualizarPost(supabase, { postId, ...data });
      setPosts((prev) =>
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
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setDeleteConfirmPost(null);
      toast.success("Publicação excluída");
    } catch (e) {
      console.error("[RedeTab excluir post]", e);
      toast.error("Não foi possível excluir a publicação.");
    }
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
    if (autorId === usuario.id || otherProfiles[autorId]) return;
    buscarPerfil(supabase, autorId)
      .then((p) => {
        if (!p) return;
        setOtherProfiles((prev) => ({
          ...prev,
          [autorId]: {
            nome: p.nome_exibicao,
            bio: p.bio ?? "",
            cor: p.cor_avatar,
          },
        }));
      })
      .catch((e) => console.error("[RedeTab perfil autor]", e));
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
      toast.success("Usuária bloqueada");
    } catch (e) {
      console.error("[RedeTab bloquear]", e);
      toast.error("Não foi possível bloquear.");
    }
  }

  // ── Notificações ──
  function markNotifRead(id: string) {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
  }
  function markAllNotifsRead() {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  // ── Chat ──
  function openChatThread(conversationId: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, naoLidas: 0 } : c))
    );
    push({ type: "chatThread", conversationId });
  }
  function openChatWithUser(userId: string) {
    const existing = conversations.find((c) => c.userId === userId);
    if (existing) {
      openChatThread(existing.id);
      return;
    }
    const nova: Conversation = {
      id: `c-${userId}`,
      userId,
      ultimaMensagem: "",
      hora: "",
      naoLidas: 0,
    };
    setConversations((prev) => [nova, ...prev]);
    setMessages((prev) => ({ ...prev, [nova.id]: [] }));
    push({ type: "chatThread", conversationId: nova.id });
  }
  // "erro" é um gatilho de demonstração — digitar exatamente essa palavra
  // mostra o estado de falha de envio de propósito, pra dar pra revisar sem
  // depender de sorte num delay aleatório.
  function settleMessage(
    conversationId: string,
    messageId: string,
    status: "sent" | "error"
  ) {
    setMessages((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] ?? []).map((m) =>
        m.id === messageId ? { ...m, status } : m
      ),
    }));
  }

  function sendMessage(conversationId: string, texto: string) {
    const id = `m-${Date.now()}`;
    const msg: RedeMessage = {
      id,
      deMim: true,
      texto,
      hora: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "sending",
    };
    setMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), msg],
    }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, ultimaMensagem: texto, hora: "agora" }
          : c
      )
    );
    const failed = texto.trim().toLowerCase() === "erro";
    setTimeout(
      () => settleMessage(conversationId, id, failed ? "error" : "sent"),
      700
    );
  }

  function retrySend(conversationId: string, messageId: string) {
    setMessages((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] ?? []).map((m) =>
        m.id === messageId ? { ...m, status: "sending" } : m
      ),
    }));
    setTimeout(() => settleMessage(conversationId, messageId, "sent"), 700);
  }

  function sharePostToChat(conversationId: string) {
    if (!shareToConvoPost) return;
    const preview =
      shareToConvoPost.texto.length > 60
        ? `${shareToConvoPost.texto.slice(0, 60)}…`
        : shareToConvoPost.texto;
    sendMessage(conversationId, `📎 Compartilhou uma publicação: "${preview}"`);
    const user = findUser(
      conversations.find((c) => c.id === conversationId)?.userId ?? ""
    );
    toast.success(
      user ? `Publicação enviada para ${user.nome}!` : "Publicação enviada!"
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
      setPerfil(updated);
      setProfileEditOpen(false);
      toast.success("Perfil atualizado!");
    } catch {
      toast.error("Não foi possível salvar o perfil.");
    }
  }

  // ── Wishlist ──
  function saveWishlist(
    form: {
      nome: string;
      valorAlvo: string;
      valorAtual: string;
      estado: WishlistItem["estado"];
      privacidade: Privacidade;
    },
    existing: WishlistItem | null
  ) {
    if (existing) {
      setWishlistItems((prev) =>
        prev.map((w) =>
          w.id === existing.id
            ? {
                ...w,
                nome: form.nome,
                valorAlvo: Number(form.valorAlvo) || w.valorAlvo,
                valorAtual: Number(form.valorAtual) || 0,
                estado: form.estado,
                privacidade: form.privacidade,
              }
            : w
        )
      );
      toast.success("Desejo atualizado!");
    } else {
      const novo: WishlistItem = {
        id: `w-${Date.now()}`,
        nome: form.nome,
        cor: WISHLIST_PALETTE[wishlistItems.length % WISHLIST_PALETTE.length],
        valorAlvo: Number(form.valorAlvo) || 0,
        valorAtual: Number(form.valorAtual) || 0,
        estado: form.estado,
        privacidade: form.privacidade,
      };
      setWishlistItems((prev) => [novo, ...prev]);
      toast.success("Desejo adicionado!");
    }
    setWishlistFormOpen(false);
    setEditingWishlist(null);
  }
  function deleteWishlist(id: string) {
    setWishlistItems((prev) => prev.filter((w) => w.id !== id));
    setDeleteConfirmWishlist(null);
    setWishlistFormOpen(false);
    setEditingWishlist(null);
    toast.success("Desejo excluído");
  }
  // Wishlist ainda é só mock (sem tabela real) -- rede_posts não tem como
  // guardar um card de desejo embutido, então isso vira um post de texto
  // normal descrevendo o progresso, publicado de verdade no Feed.
  async function shareWishlistToFeed(item: WishlistItem) {
    const progresso = Math.round((item.valorAtual / item.valorAlvo) * 100);
    try {
      const created = await criarPost(supabase, {
        categoria: "conquista",
        texto: `Compartilhando meu progresso com "${item.nome}" — ${progresso}% da meta!`,
      });
      setPosts((prev) => [feedPostFromCreated(created), ...prev]);
      setWishlistFormOpen(false);
      setEditingWishlist(null);
      toast.success("Desejo compartilhado no Feed!");
      setStack([{ type: "feed" }]);
    } catch (e) {
      console.error("[RedeTab compartilhar desejo]", e);
      toast.error("Não foi possível compartilhar no Feed.");
    }
  }

  // ── Clientes ──
  function saveCliente(
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
    if (existing) {
      setClientes((prev) =>
        prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                nome: form.nome,
                telefone: form.telefone,
                status: form.status,
                etiquetas,
                observacoes: form.observacoes,
              }
            : c
        )
      );
      toast.success("Cliente atualizado!");
    } else {
      const novo: Cliente = {
        id: `cl-${Date.now()}`,
        nome: form.nome,
        telefone: form.telefone,
        status: form.status,
        etiquetas,
        ultimoContato: new Date().toISOString().slice(0, 10),
        observacoes: form.observacoes,
      };
      setClientes((prev) => [novo, ...prev]);
      toast.success("Cliente adicionado!");
    }
    setClienteFormOpen(false);
    setEditingCliente(null);
    setClienteDetail(null);
  }
  function deleteCliente(id: string) {
    setClientes((prev) => prev.filter((c) => c.id !== id));
    setDeleteConfirmCliente(null);
    setClienteDetail(null);
    toast.success("Cliente excluído");
  }

  // ── Perfil público: dados derivados ──
  function buildProfile(userId: string) {
    if (userId === usuario.id) {
      return {
        nome: perfil?.nome_exibicao ?? usuario.nome,
        handle: undefined,
        cor: perfil?.cor_avatar,
        bio: perfil?.bio ?? "",
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
      isMe: false,
    };
  }

  const postActions = {
    onToggleLike: toggleLike,
    onComment: (p: FeedPost) => setCommentsPostId(p.id),
    onShare: (p: FeedPost) => setSharePost(p),
    onOpenMenu: (p: FeedPost) => setMenuPost(p),
  };

  return (
    <div className="pb-4">
      {screen.type === "feed" && (
        <FeedScreen
          usuario={usuario}
          posts={posts}
          friends={friends.map((f) => f.id)}
          pendingRequestsCount={requests.length}
          unreadChats={unreadChats}
          unreadNotifs={unreadNotifs}
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
          conversations={conversations}
          onBack={pop}
          onOpenThread={openChatThread}
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
              onBack={pop}
              onOpenAutor={openAutor}
              onSend={(texto) => sendMessage(convo.id, texto)}
              onRetry={(messageId) => retrySend(convo.id, messageId)}
              onComposerFocusChange={onChatFocusChange}
            />
          );
        })()}

      {screen.type === "meuEspaco" && (
        <MeuEspacoScreen
          nomeExibicao={perfil?.nome_exibicao ?? usuario.nome}
          bio={perfil?.bio ?? ""}
          cor={perfil?.cor_avatar ?? "var(--accent)"}
          meusPosts={posts.filter((p) => p.autorId === usuario.id)}
          liveLinks={liveLinks}
          wishlistItems={wishlistItems}
          clientesCount={clientes.length}
          defaultPrivacidade={defaultPrivacidade}
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
          onShareProfile={shareProfile}
          onOpenWishlist={() => push({ type: "wishlist" })}
          onOpenClientes={() => push({ type: "clientes" })}
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
              bio={profile.bio}
              isMe={profile.isMe}
              isFriend={isFriend}
              requestSent={sentRequests.includes(screen.userId)}
              liveLinks={livelinksExibidos}
              wishlistPublico={wishlistPublico}
              posts={posts.filter((p) => p.autorId === screen.userId)}
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

      {/* ── Sheets globais ── */}
      <PostComposer
        open={composerOpen}
        usuarioNome={usuario.nome}
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
        notificacoes={notificacoes}
        onOpenProfile={openAutor}
        onMarkRead={markNotifRead}
        onMarkAllRead={markAllNotifsRead}
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
            key: "externo",
            label: "Compartilhar externamente",
            Icon: Share2,
            onSelect: () => toast.success("Abrindo compartilhamento…"),
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
