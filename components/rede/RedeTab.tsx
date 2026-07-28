"use client";

import { useState } from "react";
import {
  Link2,
  Flag,
  Pencil,
  Trash2,
  Bookmark,
  Send,
  Share2,
  X,
} from "lucide-react";
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
import {
  REDE_POSTS,
  FRIEND_IDS,
  FRIEND_REQUESTS,
  DISCOVER_PEOPLE,
  CONVERSATIONS,
  MESSAGES,
  LIVE_LINKS,
  WISHLIST_ITEMS,
  CLIENTES,
  REDE_NOTIFICACOES,
  MY_BIO,
  findUser,
  type RedePost,
  type FriendRequest,
  type Conversation,
  type RedeMessage,
  type LiveLink,
  type WishlistItem,
  type Cliente,
  type RedeNotificacao,
  type Privacidade,
} from "@/lib/mockRede";
import type { Usuario } from "@/lib/types";

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

  // ── Navegação: pilha local, sem 2ª barra de navegação (o Feed é a base) ──
  const [stack, setStack] = useState<RedeScreen[]>([{ type: "feed" }]);
  const screen = stack[stack.length - 1];
  const push = (s: RedeScreen) => setStack((prev) => [...prev, s]);
  const pop = () =>
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  // ── Dados mockados, mutáveis localmente ──
  const [posts, setPosts] = useState<RedePost[]>(REDE_POSTS);
  const [friends, setFriends] = useState<string[]>(FRIEND_IDS);
  const [requests, setRequests] = useState<FriendRequest[]>(FRIEND_REQUESTS);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [conversations, setConversations] =
    useState<Conversation[]>(CONVERSATIONS);
  const [messages, setMessages] =
    useState<Record<string, RedeMessage[]>>(MESSAGES);
  const [liveLinks, setLiveLinks] = useState<LiveLink[]>(LIVE_LINKS);
  const [wishlistItems, setWishlistItems] =
    useState<WishlistItem[]>(WISHLIST_ITEMS);
  const [clientes, setClientes] = useState<Cliente[]>(CLIENTES);
  const [notificacoes, setNotificacoes] =
    useState<RedeNotificacao[]>(REDE_NOTIFICACOES);
  const [defaultPrivacidade, setDefaultPrivacidade] =
    useState<Privacidade>("amigas");

  // ── Sheets ──
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTipoInicial, setComposerTipoInicial] = useState<
    "foto" | "desejo" | undefined
  >();
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [menuPost, setMenuPost] = useState<RedePost | null>(null);
  const [sharePost, setSharePost] = useState<RedePost | null>(null);
  const [deleteConfirmPost, setDeleteConfirmPost] = useState<RedePost | null>(
    null
  );
  const [editingPost, setEditingPost] = useState<RedePost | null>(null);
  const [shareToConvoPost, setShareToConvoPost] = useState<RedePost | null>(
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

  const unreadChats = conversations.reduce((s, c) => s + c.naoLidas, 0);
  const unreadNotifs = notificacoes.filter((n) => !n.lida).length;
  const commentsPost = posts.find((p) => p.id === commentsPostId) ?? null;

  // ── Posts ──
  function toggleLike(id: string) {
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
  }

  function toggleSave(id: string) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, salvoPorMim: !p.salvoPorMim } : p))
    );
    const p = posts.find((x) => x.id === id);
    toast.success(p?.salvoPorMim ? "Removido dos salvos" : "Publicação salva!");
  }

  function addComment(postId: string, texto: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comentarios: [
                ...p.comentarios,
                {
                  id: `c-${Date.now()}`,
                  autorId: "me",
                  texto,
                  criadoEm: new Date().toISOString(),
                },
              ],
            }
          : p
      )
    );
    toast.success("Comentário publicado!");
  }

  function handlePublish(data: {
    texto: string;
    tipo: RedePost["tipo"];
    categoria: RedePost["categoria"];
    anonimo: boolean;
  }) {
    const wishlistRef = wishlistItems[0];
    const novo: RedePost = {
      id: `p-${Date.now()}`,
      autorId: data.anonimo ? "anon" : "me",
      anonimo: data.anonimo,
      texto: data.texto,
      tipo: data.tipo,
      categoria: data.categoria,
      imagemCor: data.tipo === "foto" ? WISHLIST_PALETTE[0] : undefined,
      wishlistNome: data.tipo === "desejo" ? wishlistRef?.nome : undefined,
      wishlistProgresso:
        data.tipo === "desejo" && wishlistRef
          ? Math.round((wishlistRef.valorAtual / wishlistRef.valorAlvo) * 100)
          : undefined,
      linkTitulo: data.tipo === "link" ? "Um artigo interessante" : undefined,
      linkUrl: data.tipo === "link" ? "exemplo.com/artigo" : undefined,
      criadoEm: new Date().toISOString(),
      curtidas: 0,
      curtidoPorMim: false,
      salvoPorMim: false,
      comentarios: [],
    };
    setPosts((prev) => [novo, ...prev]);
    toast.success("Publicação enviada!");
  }

  function saveEditedPost(
    postId: string,
    data: {
      texto: string;
      tipo: RedePost["tipo"];
      categoria: RedePost["categoria"];
      anonimo: boolean;
    }
  ) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              texto: data.texto,
              tipo: data.tipo,
              categoria: data.categoria,
            }
          : p
      )
    );
    toast.success("Publicação atualizada!");
  }

  function deletePost(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setDeleteConfirmPost(null);
    toast.success("Publicação excluída");
  }

  function openAutor(autorId: string) {
    if (autorId === "anon") return;
    push({ type: "perfilPublico", userId: autorId });
  }

  // ── Amigas ──
  function acceptRequest(req: FriendRequest) {
    setFriends((prev) => [...prev, req.userId]);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast.success("Agora vocês são amigas!");
  }
  function declineRequest(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }
  function sendRequest(userId: string) {
    setSentRequests((prev) => [...prev, userId]);
    toast.success("Solicitação enviada!");
  }
  function removeFriend(userId: string) {
    setFriends((prev) => prev.filter((id) => id !== userId));
    toast.success("Amiga removida");
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
  function toggleLiveLink(id: string) {
    setLiveLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ativo: !l.ativo } : l))
    );
  }
  function moveLiveLink(id: string, direction: "up" | "down") {
    setLiveLinks((prev) => {
      const sorted = [...prev].sort((a, b) => a.ordem - b.ordem);
      const idx = sorted.findIndex((l) => l.id === id);
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapWith];
      return prev.map((l) => {
        if (l.id === a.id) return { ...l, ordem: b.ordem };
        if (l.id === b.id) return { ...l, ordem: a.ordem };
        return l;
      });
    });
  }
  function shareProfile() {
    toast.success("Link do perfil copiado!");
  }
  function saveLiveLink(id: string, data: { label: string; url: string }) {
    setLiveLinks((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, label: data.label, url: data.url } : l
      )
    );
    setEditingLiveLink(null);
    toast.success("LiveLink atualizado!");
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
  function shareWishlistToFeed(item: WishlistItem) {
    const novo: RedePost = {
      id: `p-${Date.now()}`,
      autorId: "me",
      anonimo: false,
      texto: `Compartilhando meu progresso com "${item.nome}"!`,
      tipo: "desejo",
      categoria: "conquista",
      wishlistNome: item.nome,
      wishlistProgresso: Math.round((item.valorAtual / item.valorAlvo) * 100),
      criadoEm: new Date().toISOString(),
      curtidas: 0,
      curtidoPorMim: false,
      salvoPorMim: false,
      comentarios: [],
    };
    setPosts((prev) => [novo, ...prev]);
    setWishlistFormOpen(false);
    setEditingWishlist(null);
    toast.success("Desejo compartilhado no Feed!");
    setStack([{ type: "feed" }]);
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
    if (userId === "me") {
      return {
        nome: usuario.nome,
        handle: undefined,
        cor: undefined,
        bio: MY_BIO,
        isMe: true,
      };
    }
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
    onToggleSave: toggleSave,
    onComment: (p: RedePost) => setCommentsPostId(p.id),
    onShare: (p: RedePost) => setSharePost(p),
    onOpenMenu: (p: RedePost) => setMenuPost(p),
  };

  return (
    <div className="pb-4">
      {screen.type === "feed" && (
        <FeedScreen
          usuario={usuario}
          posts={posts}
          friends={friends}
          pendingRequestsCount={requests.length}
          unreadChats={unreadChats}
          unreadNotifs={unreadNotifs}
          onOpenSearch={() => push({ type: "busca" })}
          onOpenNotifs={() => setNotifSheetOpen(true)}
          onOpenChat={() => push({ type: "chatList" })}
          onOpenMeuEspaco={() => push({ type: "meuEspaco" })}
          onOpenAmigas={() => push({ type: "amigas" })}
          onOpenWishlist={() => push({ type: "wishlist" })}
          onOpenComposer={(tipo) => {
            setComposerTipoInicial(tipo);
            setComposerOpen(true);
          }}
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
        />
      )}

      {screen.type === "amigas" && (
        <AmigasScreen
          friends={friends}
          requests={requests}
          sentRequests={sentRequests}
          discoverPeople={DISCOVER_PEOPLE}
          onBack={pop}
          onAccept={acceptRequest}
          onDecline={declineRequest}
          onSendRequest={sendRequest}
          onRemoveFriend={removeFriend}
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
          usuario={usuario}
          meusPosts={posts.filter((p) => p.autorId === "me")}
          liveLinks={liveLinks}
          wishlistItems={wishlistItems}
          clientesCount={clientes.length}
          defaultPrivacidade={defaultPrivacidade}
          onBack={pop}
          onToggleLiveLink={toggleLiveLink}
          onMoveLiveLink={moveLiveLink}
          onEditLiveLink={(link) => setEditingLiveLink(link)}
          onShareProfile={shareProfile}
          onOpenWishlist={() => push({ type: "wishlist" })}
          onOpenClientes={() => push({ type: "clientes" })}
          onOpenPerfilPublico={() =>
            push({ type: "perfilPublico", userId: "me" })
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
            : friends.includes(screen.userId);
          const wishlistPublico = profile.isMe
            ? wishlistItems.filter((w) => w.privacidade === "comunidade")
            : [];
          return (
            <PerfilPublicoScreen
              nome={profile.nome}
              handle={profile.handle}
              cor={profile.cor}
              bio={profile.bio}
              isMe={profile.isMe}
              isFriend={isFriend}
              requestSent={sentRequests.includes(screen.userId)}
              liveLinks={liveLinks}
              wishlistPublico={wishlistPublico}
              posts={posts.filter(
                (p) => !p.anonimo && p.autorId === screen.userId
              )}
              usuario={usuario}
              onBack={pop}
              onOpenChat={() => openChatWithUser(screen.userId)}
              onSendRequest={() => sendRequest(screen.userId)}
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
        tipoInicial={composerTipoInicial}
        editingPost={editingPost}
        onClose={() => {
          setComposerOpen(false);
          setEditingPost(null);
        }}
        onPublish={handlePublish}
        onSaveEdit={saveEditedPost}
      />

      <CommentsSheet
        post={commentsPost}
        usuarioNome={usuario.nome}
        onClose={() => setCommentsPostId(null)}
        onAddComment={addComment}
        onOpenAutor={openAutor}
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
            : menuPost.autorId === "me"
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
                    key: "salvar",
                    label: menuPost.salvoPorMim
                      ? "Remover dos salvos"
                      : "Salvar publicação",
                    Icon: Bookmark,
                    onSelect: () => toggleSave(menuPost.id),
                  },
                  {
                    key: "denunciar",
                    label: "Denunciar",
                    Icon: Flag,
                    danger: true,
                    onSelect: () => toast.success("Denúncia enviada, obrigada"),
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
        link={editingLiveLink}
        onClose={() => setEditingLiveLink(null)}
        onSave={saveLiveLink}
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
