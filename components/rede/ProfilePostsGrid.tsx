"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIA_META, type FeedPost } from "@/lib/rede/feed";
import { ProfilePhotoViewer } from "./ProfilePhotoViewer";

/**
 * Grade estilo Instagram das publicações de um perfil (ticket #139, Meu
 * espaço; reutilizada em #140, Perfil público — mesma necessidade nas
 * duas telas, contrato de paridade §"Meu perfil" ponto 5). Substitui a
 * lista vertical de `PostCard` que existia antes.
 *
 * Tocar numa célula com foto abre o `ProfilePhotoViewer` dedicado
 * (decisão do usuário 2026-09-22 — visual aprovado em /dev-preview/ios
 * prescreve um sheet de foto pro tap na grade; a 1ª tentativa desta
 * ticket, expandir o `PostCard` inline citando a decisão de PR #112
 * sobre o FEED, foi revertida por não se aplicar a este contexto).
 * Células de post sem foto mostram um trecho do texto real, mas não são
 * clicáveis — não há foto pra visualizar e nenhum outro destino foi
 * pedido pela ticket.
 *
 * O componente cuida sozinho de: histórico do navegador (Voltar fecha o
 * visualizador antes de sair da tela — mesmo padrão já usado em
 * AjustesTab.tsx `openSettingsPage`/`closeSettingsPage`), foco de volta
 * pra célula que abriu, e bloqueio de scroll do fundo (dentro do próprio
 * `ProfilePhotoViewer`).
 */
interface Props {
  posts: FeedPost[];
  emptyMessage: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
}

/** Retrato de texto -- mostrado quando não há (ou falhou) a miniatura.
 * Usado nos dois casos de `GridTile` (post sem foto nenhuma, e post com
 * foto cuja miniatura falhou mesmo após a renovação) -- extraído pra não
 * repetir o mesmo bloco duas vezes dentro do mesmo componente. */
function TextoFallback({
  post,
  cat,
}: {
  post: FeedPost;
  cat: { label: string; rgb: string };
}) {
  return (
    <div
      className="w-full h-full flex items-center justify-center p-2"
      style={{ background: `rgb(${cat.rgb} / 0.12)` }}
    >
      <p
        className="text-[10px] leading-snug text-center"
        style={{
          color: `rgb(${cat.rgb})`,
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {post.texto || cat.label}
      </p>
    </div>
  );
}

function GridTile({
  post,
  onOpen,
  onRenovarFoto,
}: {
  post: FeedPost;
  onOpen: (post: FeedPost, trigger: HTMLButtonElement) => void;
  onRenovarFoto: (path: string) => Promise<string | null>;
}) {
  const foto = post.fotos[0];
  const [src, setSrc] = useState<string | null>(foto?.thumbUrl ?? null);
  const cat = CATEGORIA_META[post.categoria];
  // Trava contra loop: uma miniatura pode falhar de novo mesmo depois de
  // renovada (permissão revogada, não só TTL vencido) -- sem isso, cada
  // falha da URL renovada dispara outro onError -> outra renovação, sem
  // fim. Tenta renovar no máximo 1 vez; se a renovada também falhar, cai
  // no retrato de texto (degrada, não trava em loop). Mesma preocupação
  // de FeedFotos.tsx, versão mínima adequada a uma miniatura de grade.
  const tentouRenovar = useRef(false);

  async function handleImgError() {
    if (!foto || tentouRenovar.current) {
      setSrc(null);
      return;
    }
    tentouRenovar.current = true;
    // thumbPath, não path: a grade mostra a MINIATURA (thumbUrl); a
    // principal em alta resolução só é buscada pelo ProfilePhotoViewer,
    // que recebe o `post` inteiro e cuida disso sozinho via PhotoStage.
    const renovada = await onRenovarFoto(foto.thumbPath);
    setSrc(renovada);
  }

  if (!foto) {
    // Sem foto: mostra o texto real, mas não abre nada -- não existe
    // visualizador de texto, e inventar um destino novo pra essas
    // células não foi pedido pela ticket.
    return (
      <div className="relative aspect-square overflow-hidden">
        <TextoFallback post={post} cat={cat} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => onOpen(post, e.currentTarget)}
      aria-label={`Abrir foto da publicação: ${post.texto.slice(0, 40) || "sem legenda"}`}
      className="relative aspect-square overflow-hidden active:opacity-80 transition-opacity"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura assinada (Storage), não um asset estático do Next
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={handleImgError}
        />
      ) : (
        <TextoFallback post={post} cat={cat} />
      )}
    </button>
  );
}

/** Chave usada em `window.history.state` pra saber, no popstate, se foi o
 * visualizador de foto que empurrou a entrada de histórico (e não alguma
 * outra navegação da Rede) -- mesmo padrão de AjustesTab.tsx
 * (`jobappSettingsPage`), nome próprio pra não colidir. */
const HISTORY_KEY = "jobappPhotoViewer";

export function ProfilePostsGrid({
  posts,
  emptyMessage,
  onRenovarFoto,
}: Props) {
  const [viewerPostId, setViewerPostId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Voltar do navegador fecha o visualizador primeiro, antes de sair da
  // tela -- mesmo mecanismo já usado em AjustesTab.tsx. Só fecha se a
  // PRÓPRIA chave saiu do estado: TabPanel mantém todas as abas montadas
  // (display:none, nunca desmonta), então um popstate de outra aba (ex.:
  // fechando uma sub-página de Ajustes) também chegaria aqui -- sem essa
  // checagem, um único Voltar fecharia os dois ao mesmo tempo.
  useEffect(() => {
    function onPopState() {
      if (!window.history.state?.[HISTORY_KEY]) setViewerPostId(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Restaura o foco na célula que abriu o visualizador, ao fechar.
  useEffect(() => {
    if (viewerPostId) return;
    const frame = window.requestAnimationFrame(() => {
      lastTriggerRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [viewerPostId]);

  function openViewer(post: FeedPost, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    window.history.pushState(
      { ...window.history.state, [HISTORY_KEY]: true },
      ""
    );
    setViewerPostId(post.id);
  }

  function closeViewer() {
    if (window.history.state?.[HISTORY_KEY]) window.history.back();
    else setViewerPostId(null);
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {emptyMessage}
      </p>
    );
  }

  const viewerPost = posts.find((p) => p.id === viewerPostId) ?? null;

  return (
    <div>
      <div className="grid grid-cols-3 gap-0.5 rounded-xl overflow-hidden">
        {posts.map((post) => (
          <GridTile
            key={post.id}
            post={post}
            onOpen={openViewer}
            onRenovarFoto={onRenovarFoto}
          />
        ))}
      </div>
      <ProfilePhotoViewer
        post={viewerPost}
        onClose={closeViewer}
        onRenovarFoto={onRenovarFoto}
      />
    </div>
  );
}
