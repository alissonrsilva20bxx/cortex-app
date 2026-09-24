"use client";

import { useState } from "react";
import {
  MessageCircle,
  UserPlus,
  Check,
  MoreHorizontal,
  Ban,
  X,
} from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ProfileIdentityHeader } from "./ProfileIdentityHeader";
import { LiveLinksPreview, type LiveLink } from "./LiveLinksSection";
import { WishlistCard } from "./WishlistCard";
import { ProfilePostsGrid } from "./ProfilePostsGrid";
import { OptionsSheet } from "./OptionsSheet";
import { SkeletonProfileHeader, SkeletonList, SkeletonGrid } from "./Skeleton";
import type { WishlistItem } from "@/lib/mockRede";
import type { FeedPost } from "@/lib/rede/feed";

interface Props {
  nome: string;
  handle?: string;
  cor?: string;
  fotoUrl?: string | null;
  bio: string;
  isMe: boolean;
  isFriend: boolean;
  requestSent: boolean;
  liveLinks: LiveLink[];
  wishlistPublico: WishlistItem[];
  posts: FeedPost[];
  /** Carregamento real de buscarPerfil (RedeTab) -- só verdadeiro na primeira
   * visita a um perfil ainda não cacheado, não um timeout fixo. */
  loading: boolean;
  /** buscarPerfil falhou -- estado persistente, distinto do fallback estático. */
  error: boolean;
  onBack: () => void;
  onOpenChat?: () => void;
  onSendRequest?: () => void;
  onBlock?: () => void;
  /** Renova a URL assinada de uma foto (miniatura ou principal) --
   * `ProfilePostsGrid`/`ProfilePhotoViewer` cuidam do resto (curtir/
   * comentar/compartilhar ficam só no feed, não duplicados aqui -- mesmo
   * contrato de `MeuEspacoScreen`, ticket #139). */
  onRenovarFoto: (path: string) => Promise<string | null>;
  /** Dispara o fluxo real de denúncia (RedeTab: `setReportTarget`), ticket
   * #140. Sempre recebido de `RedeTab` (mesmo callback estável usado pelo
   * `PostCard`), mas só repassado à grade quando `!isMe` (ver abaixo) --
   * nunca no preview do próprio perfil, onde toda publicação é sua. */
  onReportPost?: (postId: string) => void;
}

export function PerfilPublicoScreen({
  nome,
  handle,
  cor,
  fotoUrl,
  bio,
  isMe,
  isFriend,
  requestSent,
  liveLinks,
  wishlistPublico,
  posts,
  loading,
  error,
  onBack,
  onOpenChat,
  onSendRequest,
  onBlock,
  onRenovarFoto,
  onReportPost,
}: Props) {
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  return (
    <div className="pb-4">
      <ScreenHeader
        title={isMe ? "Preview público" : "Perfil"}
        onBack={onBack}
      />

      {loading ? (
        <>
          <SkeletonProfileHeader />
          <div className="space-y-6">
            <SkeletonList rows={2} />
            <SkeletonGrid items={2} />
          </div>
        </>
      ) : error ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--danger)" }}
        >
          Não foi possível carregar este perfil. Tente novamente mais tarde.
        </p>
      ) : (
        <>
          {/* Identidade — mesma hierarquia de #139 (§ Meu perfil: avatar,
              nome, bio), sem números (contrato só os exige explicitamente
              pro próprio perfil) e sem avatar editável (nunca em perfil de
              outra pessoa, inclusive no preview do próprio). */}
          <ProfileIdentityHeader
            nome={nome}
            bio={bio}
            cor={cor}
            fotoUrl={fotoUrl}
            handle={handle}
          />

          {/* LiveLinks discretos entre bio e ações — regra não-negociável
              do mapa #122, válida em qualquer tela de perfil, não só a
              própria. Antes desta ticket, esta seção vinha DEPOIS da linha
              de ações; reposicionada aqui, sem mudar o dado exibido
              (`liveLinks` de terceiros continua vazio -- fora do escopo
              já registrado, ver RedeTab.tsx). */}
          <div className="mb-4">
            <LiveLinksPreview links={liveLinks} />
          </div>

          <div className="flex flex-col items-center text-center mb-6">
            {!isMe && (
              <div className="flex items-center gap-2">
                {isFriend ? (
                  <button
                    onClick={onOpenChat}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-opacity active:opacity-70"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    <MessageCircle size={13} />
                    Conversar
                  </button>
                ) : requestSent ? (
                  <span
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold"
                    style={{
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <Check size={13} />
                    Solicitação enviada
                  </span>
                ) : (
                  <button
                    onClick={onSendRequest}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-opacity active:opacity-70"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    <UserPlus size={13} />
                    Adicionar
                  </button>
                )}
                {onBlock && (
                  <button
                    onClick={() => setBlockConfirmOpen(true)}
                    aria-label="Mais opções"
                    className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
                    style={{
                      width: 44,
                      height: 44,
                      border: "1px solid var(--border-color)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                )}
              </div>
            )}
            {isMe && (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                É assim que quem não é sua amiga vê seu perfil.
              </p>
            )}
          </div>

          {wishlistPublico.length > 0 && (
            <section className="mb-6">
              <p className="section-label mb-3">Desejos</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {wishlistPublico.map((item) => (
                  <WishlistCard key={item.id} item={item} compact />
                ))}
              </div>
            </section>
          )}

          {/* Grade de publicações estilo Instagram — mesma paridade de
              #139 (§ Meu perfil, ponto 5), reusando `ProfilePostsGrid`
              (genérico, recebe posts/callbacks, nada específico de "Meu
              espaço"). `onReportPost` só chega quando `!isMe` -- é assim
              que "Denunciar publicação" nunca aparece no preview do
              próprio perfil, sem a grade/visualizador precisarem saber
              nada sobre autoria (achado do review de Standards de #140:
              denunciar é moderação/segurança, não pode desaparecer só
              porque o post saiu da paginação do feed). */}
          <section>
            <p className="section-label mb-3">Publicações</p>
            <ProfilePostsGrid
              posts={posts}
              emptyMessage={
                isMe
                  ? "Você ainda não publicou nada."
                  : "Nenhuma publicação ainda."
              }
              onRenovarFoto={onRenovarFoto}
              onReportPost={isMe ? undefined : onReportPost}
            />
          </section>
        </>
      )}

      <OptionsSheet
        open={blockConfirmOpen}
        title={`Bloquear ${nome}?`}
        onClose={() => setBlockConfirmOpen(false)}
        options={[
          {
            key: "confirmar",
            label: "Sim, bloquear",
            Icon: Ban,
            danger: true,
            onSelect: () => onBlock?.(),
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
