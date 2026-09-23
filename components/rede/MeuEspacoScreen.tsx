"use client";

import { useState } from "react";
import {
  Share2,
  Pencil,
  Plus,
  MoreHorizontal,
  Eye,
  Gift,
  Users2,
  Shield,
  ShieldOff,
  Link2,
} from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ProfileIdentityHeader } from "./ProfileIdentityHeader";
import { OptionsSheet } from "./OptionsSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  LiveLinksEditor,
  LiveLinksPreview,
  type LiveLink,
} from "./LiveLinksSection";
import { ProfilePostsGrid } from "./ProfilePostsGrid";
import { SkeletonProfileHeader, SkeletonList, SkeletonGrid } from "./Skeleton";
import { type Privacidade } from "@/lib/mockRede";
import type { FeedPost } from "@/lib/rede/feed";

interface Props {
  nomeExibicao: string;
  bio: string;
  cor: string;
  fotoUrl: string | null;
  meusPosts: FeedPost[];
  liveLinks: LiveLink[];
  clientesCount: number;
  /** Amigas reais (RedeTab já carrega `friends` pra Amigas/gate de bloqueio)
   * — só a contagem, nenhum dado novo. */
  friendsCount: number;
  defaultPrivacidade: Privacidade;
  /** Carregamento real do próprio perfil (RedeTab) -- não um timeout fixo. */
  loading: boolean;
  /** Falha real ao carregar o próprio perfil -- estado persistente. */
  error: boolean;
  onBack: () => void;
  onMoveLiveLink: (id: string, direction: "up" | "down") => void;
  onEditLiveLink: (link: LiveLink) => void;
  onDeleteLiveLink: (id: string) => void;
  onAddLiveLink: () => void;
  onEditProfile: () => void;
  onEditAvatar: () => void;
  onShareProfile: () => void;
  /** Abre o composer real de novo post — mesmo `setComposerOpen` que o FAB
   * já usa (RedeTab), nenhum fluxo de publicação paralelo. */
  onPublish: () => void;
  onOpenWishlist: () => void;
  onOpenClientes: () => void;
  onOpenBloqueados: () => void;
  onOpenPerfilPublico: () => void;
  onChangeDefaultPrivacidade: (p: Privacidade) => void;
  /** Renova a URL assinada de uma foto (miniatura ou principal) --
   * `ProfilePostsGrid`/`ProfilePhotoViewer` cuidam do resto (curtir/
   * comentar/compartilhar ficam só no feed, não duplicados aqui). */
  onRenovarFoto: (path: string) => Promise<string | null>;
}

/**
 * Botão de ação da linha Editar perfil / Publicar / Compartilhar —
 * geometria portada de IosPrototypeApp.module.css `.profileActions`
 * (grid 1fr 1fr 44px, botões 44px, radius 12px), cor sempre tokens de
 * tema (nunca a borda/fundo fixos do protótipo).
 */
function ProfileActionButton({
  icon,
  label,
  onClick,
  iconOnly,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  iconOnly?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center gap-1.5 text-xs font-bold transition-opacity active:opacity-70"
      style={{
        minHeight: 44,
        borderRadius: 12,
        border: "1px solid var(--border-color)",
        background: "var(--surface)",
        color: "var(--text)",
      }}
    >
      {icon}
      {!iconOnly && label}
    </button>
  );
}

export function MeuEspacoScreen({
  nomeExibicao,
  bio,
  cor,
  fotoUrl,
  meusPosts,
  liveLinks,
  clientesCount,
  friendsCount,
  defaultPrivacidade,
  loading,
  error,
  onBack,
  onMoveLiveLink,
  onEditLiveLink,
  onDeleteLiveLink,
  onAddLiveLink,
  onEditProfile,
  onEditAvatar,
  onShareProfile,
  onPublish,
  onOpenWishlist,
  onOpenClientes,
  onOpenBloqueados,
  onOpenPerfilPublico,
  onChangeDefaultPrivacidade,
  onRenovarFoto,
}: Props) {
  const [ferramentasOpen, setFerramentasOpen] = useState(false);
  const [liveLinksSheetOpen, setLiveLinksSheetOpen] = useState(false);
  const [privacidadeSheetOpen, setPrivacidadeSheetOpen] = useState(false);

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Meu espaço"
        onBack={onBack}
        action={
          <button
            onClick={() => setFerramentasOpen(true)}
            aria-label="Ferramentas do perfil"
            className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
            style={{
              width: 44,
              height: 44,
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            <MoreHorizontal size={18} />
          </button>
        }
      />

      {loading ? (
        <>
          <SkeletonProfileHeader />
          <div className="space-y-6">
            <SkeletonList rows={1} />
            <SkeletonGrid items={3} />
          </div>
        </>
      ) : error ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--danger)" }}
        >
          Não foi possível carregar seu espaço. Tente novamente mais tarde.
        </p>
      ) : (
        <>
          {/* Identidade — hierarquia do contrato de paridade (§ Meu perfil):
              1. avatar e números; 2. nome e bio. */}
          <ProfileIdentityHeader
            nome={nomeExibicao}
            bio={bio}
            cor={cor}
            fotoUrl={fotoUrl}
            avatarEditable
            onEditAvatar={onEditAvatar}
            stats={[
              { value: meusPosts.length, label: "publicações" },
              { value: friendsCount, label: "amigas" },
              { value: clientesCount, label: "clientes" },
            ]}
          />

          {/* LiveLinks discretos — entre bio e ações (regra não-negociável
              do mapa #122), sem cabeçalho de seção nem controles de
              edição aqui: gerenciar (adicionar/editar/excluir/reordenar)
              mudou pro menu de ferramentas (ver abaixo), preservando as
              4 operações intactas. */}
          <div className="mb-4">
            <LiveLinksPreview links={liveLinks} />
          </div>

          {/* Ações — Editar perfil / Publicar / Compartilhar (contrato de
              paridade § Meu perfil, ponto 4). Todos os 3 apontam pros
              fluxos reais já existentes (ProfileEditForm, PostComposer via
              o mesmo setComposerOpen do FAB, compartilhamento real). */}
          <div
            className="grid gap-2 mb-6"
            style={{ gridTemplateColumns: "1fr 1fr 44px" }}
          >
            <ProfileActionButton
              icon={<Pencil size={15} />}
              label="Editar perfil"
              onClick={onEditProfile}
            />
            <ProfileActionButton
              icon={<Plus size={16} />}
              label="Publicar"
              onClick={onPublish}
            />
            <ProfileActionButton
              icon={<Share2 size={16} />}
              label="Compartilhar perfil"
              onClick={onShareProfile}
              iconOnly
            />
          </div>

          {/* Grade de publicações — contrato de paridade § Meu perfil,
              ponto 5. Só esta grade: nenhuma segunda aba (proibido pelo
              contrato). */}
          <section>
            <p className="section-label mb-3">Publicações</p>
            <ProfilePostsGrid
              posts={meusPosts}
              emptyMessage="Você ainda não publicou nada."
              onRenovarFoto={onRenovarFoto}
            />
          </section>
        </>
      )}

      {/* Ferramentas do perfil — tudo que o contrato de paridade manda
          preservar "no menu de ferramentas": ver como perfil público,
          Desejos, Clientes privados, privacidade padrão, bloqueados,
          gerenciamento de LiveLinks. Nenhuma dessas 6 funções mudou —
          só saíram de seções sempre visíveis pra dentro deste menu. */}
      <OptionsSheet
        open={ferramentasOpen}
        title="Ferramentas do perfil"
        onClose={() => setFerramentasOpen(false)}
        chevron
        options={[
          {
            key: "preview",
            label: "Ver como perfil público",
            Icon: Eye,
            onSelect: onOpenPerfilPublico,
          },
          {
            key: "desejos",
            label: "Desejos",
            Icon: Gift,
            onSelect: onOpenWishlist,
          },
          {
            key: "clientes",
            label: "Clientes privados",
            Icon: Users2,
            onSelect: onOpenClientes,
          },
          {
            key: "livelinks",
            label: "Gerenciar LiveLinks",
            Icon: Link2,
            onSelect: () => setLiveLinksSheetOpen(true),
          },
          {
            key: "privacidade",
            label: "Privacidade das publicações",
            Icon: Shield,
            onSelect: () => setPrivacidadeSheetOpen(true),
          },
          {
            key: "bloqueados",
            label: "Pessoas bloqueadas",
            Icon: ShieldOff,
            onSelect: onOpenBloqueados,
          },
        ]}
      />

      <BottomSheet
        open={liveLinksSheetOpen}
        onClose={() => setLiveLinksSheetOpen(false)}
        title="LiveLinks"
        largeCloseTarget
      >
        <div className="px-5 py-3 pb-6">
          <LiveLinksEditor
            links={liveLinks}
            onMove={onMoveLiveLink}
            onEdit={onEditLiveLink}
            onDelete={onDeleteLiveLink}
            onAdd={onAddLiveLink}
          />
        </div>
      </BottomSheet>

      <BottomSheet
        open={privacidadeSheetOpen}
        onClose={() => setPrivacidadeSheetOpen(false)}
        title="Privacidade das publicações"
        largeCloseTarget
      >
        <div className="px-5 py-3 pb-6">
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Quem vê suas novas publicações por padrão
          </p>
          <SegmentedControl<Privacidade>
            size="sm"
            fullWidth
            value={defaultPrivacidade}
            onChange={onChangeDefaultPrivacidade}
            options={[
              { id: "privado", label: "Privado" },
              { id: "amigas", label: "Amigas" },
              { id: "comunidade", label: "Comunidade" },
            ]}
          />
        </div>
      </BottomSheet>
    </div>
  );
}
