"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { PhotoStage, prefereMovimentoReduzido } from "./FeedFotos";
import { ReportMenuButton } from "./ReportMenuButton";
import { resolveScrollBehavior } from "@/lib/rede/chatUi";
import type { FeedPost } from "@/lib/rede/feed";

/**
 * Visualizador dedicado da grade de perfil (ticket #139/#140, redesign
 * iOS) — decisão do usuário 2026-09-22, substituindo a 1ª tentativa
 * (expandir o `PostCard` inline), que a revisão de Spec apontou como
 * divergente do protótipo aprovado (`/dev-preview/ios`, tela
 * "alexsilva": tocar num tile abre um sheet com a foto principal em alta
 * qualidade). Mesmo componente usado no perfil próprio (#139) e público
 * (#140) — só o `post` que muda.
 *
 * Reusa `PhotoStage` (FeedFotos.tsx) pra toda a parte delicada de
 * mídia: URL assinada, crossfade miniatura→principal, renovação com
 * trava-contra-loop, retry em caso de erro. Só a casca (tela cheia,
 * carrossel entre até 2 fotos, fechar) é nova — nada de assinatura/
 * storage/API novo, tudo reaproveitado de `lib/rede/feed.ts`.
 *
 * Sem curtir/comentar/compartilhar aqui: só a foto. Essas ações já
 * existem no feed (`PostCard`) — duplicá-las na grade seria inventar
 * uma segunda superfície de interação só por parecer com o Instagram,
 * o que a ticket pediu explicitamente pra não fazer.
 *
 * Exceção: "Denunciar publicação" (ticket #140, achado do review de
 * Standards em cima de #139) — diferente de curtir/comentar/compartilhar,
 * denunciar é moderação/segurança, não convenção de engajamento; o
 * contrato de paridade exige que uma função nunca desapareça, só mude de
 * posição. `onReportPost` só chega aqui quando o post é de outra pessoa
 * (`PerfilPublicoScreen` decide isso, nunca este componente) -- reusa
 * integralmente o fluxo real de denúncia (RedeTab: `reportTarget` /
 * `submitReport` / sheet "Motivo da denúncia" / `criarDenuncia` / toast),
 * só com um "..." mais direto (sem o menu Editar/Excluir/Denunciar do
 * `PostCard`, que não se aplica aqui -- já sabemos que não é o dono).
 */
interface Props {
  /** Post cujas fotos estão sendo vistas, ou `null` = fechado. Quem
   * decide QUANDO abrir/fechar (histórico do navegador, foco de volta
   * pra célula) é o pai (`ProfilePostsGrid`) — este componente só
   * desenha o que `post` manda. */
  post: FeedPost | null;
  onClose: () => void;
  onRenovarFoto: (path: string) => Promise<string | null>;
  /** Presente = mostra "..." com "Denunciar publicação" no cabeçalho;
   * ausente (undefined) = nunca mostra -- é assim que o próprio perfil
   * (#139) nunca exibe a opção, sem este componente precisar saber nada
   * sobre autoria. */
  onReportPost?: (postId: string) => void;
}

export function ProfilePhotoViewer({
  post,
  onClose,
  onRenovarFoto,
  onReportPost,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [indice, setIndice] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const postId = post?.id ?? null;
  useEffect(() => {
    setIndice(0);
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, [postId]);

  // Bloqueia o scroll do fundo (grade/documento) enquanto o visualizador
  // está aberto -- restaura o valor anterior ao fechar, nunca força "".
  useEffect(() => {
    if (!post) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [post]);

  // Escape fecha; setas do teclado navegam entre as até-2 fotos. Foco vai
  // pro botão fechar assim que abre (o pai já cuida de devolver o foco
  // pra célula da grade quando `post` volta a `null`).
  useEffect(() => {
    if (!post) return;
    closeButtonRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "ArrowLeft") irPara(-1);
      if (e.key === "ArrowRight") irPara(1);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

  function irPara(dir: number) {
    const el = scrollerRef.current;
    if (!el || !post) return;
    const w = el.clientWidth;
    const alvo = Math.max(
      0,
      Math.min(post.fotos.length - 1, Math.round(el.scrollLeft / w) + dir)
    );
    el.scrollTo({
      left: alvo * w,
      behavior: resolveScrollBehavior(prefereMovimentoReduzido()),
    });
  }

  // índice = slide encaixado (mesmo cálculo de Carrossel em FeedFotos.tsx).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !post) return;
    let raf = 0;
    function aoRolar() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return;
        const w = el.clientWidth || 1;
        const i = Math.max(
          0,
          Math.min((post?.fotos.length ?? 1) - 1, Math.round(el.scrollLeft / w))
        );
        setIndice(i);
      });
    }
    el.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      el.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(raf);
    };
  }, [post]);

  if (!mounted || !post || post.fotos.length === 0) return null;
  const fotos = post.fotos;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto da publicação de ${post.autorNome}`}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "rgba(8, 8, 10, 0.96)" }}
    >
      <div
        className="flex items-center justify-end gap-2 shrink-0"
        style={{
          padding: "12px",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
        }}
      >
        {onReportPost && (
          <ReportMenuButton onReport={() => onReportPost(post.id)} />
        )}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex items-center justify-center rounded-full active:opacity-70"
          style={{
            width: 44,
            height: 44,
            background: "rgba(255, 255, 255, 0.12)",
            color: "#fff",
          }}
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollerRef}
          className="absolute inset-0 flex"
          style={{
            overflowX: fotos.length > 1 ? "auto" : "hidden",
            overflowY: "hidden",
            scrollSnapType: fotos.length > 1 ? "x mandatory" : undefined,
            overscrollBehaviorX: "contain",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {fotos.map((foto) => (
            <div
              key={foto.ordem}
              style={{
                position: "relative",
                minWidth: "100%",
                height: "100%",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
              }}
            >
              {/* renderPrincipal sempre true: no máx. 2 fotos por post, as
                  duas começam a carregar assim que o visualizador abre —
                  "preload da próxima" fica automático, sem lógica extra. */}
              <PhotoStage
                foto={foto}
                alt={`Foto ${foto.ordem} da publicação de ${post.autorNome}`}
                onRenovarFoto={onRenovarFoto}
                renderPrincipal
              />
            </div>
          ))}
        </div>

        {fotos.length > 1 && indice > 0 && (
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => irPara(-1)}
            className="feed-foto-seta"
            style={{ ...setaBase, left: 8 }}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {fotos.length > 1 && indice < fotos.length - 1 && (
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => irPara(1)}
            className="feed-foto-seta"
            style={{ ...setaBase, right: 8 }}
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {fotos.length > 1 && (
        <div
          aria-hidden
          className="flex justify-center shrink-0"
          style={{
            gap: 6,
            paddingTop: 10,
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          }}
        >
          {fotos.map((f, i) => (
            <span
              key={f.ordem}
              style={{
                width: i === indice ? 7 : 6,
                height: i === indice ? 7 : 6,
                borderRadius: "50%",
                background: i === indice ? "#fff" : "rgba(255,255,255,0.4)",
                transition: "all 160ms",
              }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// Mesmo padrão de components/rede/FeedFotos.tsx (`.feed-foto-seta`,
// styles/globals.css): setas só sob (hover:hover) and (pointer:fine),
// nunca no touch. `display` fica pra regra global de propósito.
const setaBase: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: 44,
  height: 44,
  padding: 6,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.14)",
  backgroundClip: "content-box",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};
