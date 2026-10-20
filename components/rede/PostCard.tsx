"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { FeedFotos } from "./FeedFotos";
import { LequeFotos } from "./LequeFotos";
import {
  IconeComentario,
  IconeCoracao,
  IconeEnviar,
  IconeReticencias,
} from "./redeIcones";
import { formatRelativeTime } from "@/lib/mockRede";
import { CATEGORIA_META, type FeedPost } from "@/lib/rede/feed";
import s from "./doca.module.css";

interface Props {
  post: FeedPost;
  onToggleLike: (id: string) => void;
  onComment: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onOpenMenu: (post: FeedPost) => void;
  onOpenAutor: (autorId: string) => void;
  /** URL assinada (5min) da MINIATURA pode expirar com a aba aberta --
   * chamado ao detectar falha de carregamento; devolve uma URL nova pro
   * mesmo path, ou `null` se a renovação falhar (ex.: bloqueio mudou). */
  onRenovarFoto: (path: string) => Promise<string | null>;
  /** A autora é amiga de quem lê: a linha do tempo ganha "· amiga". */
  amiga?: boolean;
}

/** Texto acima disso nasce cortado em 4 linhas, com "ver mais". */
const TEXTO_LONGO = 200;
/** Tempo entre dois toques na foto para contar como duplo, em ms. */
const DUPLO_MS = 280;

function prefereMenosMovimento() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** As partículas que saem do coração ao curtir (só visual, 600 ms). */
function Particulas() {
  const [pontos] = useState(() =>
    Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.35;
      const d = 30 + Math.random() * 40;
      return {
        dx: Math.cos(a) * d,
        dy: Math.sin(a) * d,
        atraso: Math.round(Math.random() * 60),
      };
    })
  );
  return (
    <span className={s.particulas} aria-hidden data-particulas="">
      {pontos.map((p, i) => (
        <i
          key={i}
          className={s.particula}
          style={
            {
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--atraso": `${p.atraso}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * Post da Rede no modelo Doca (protótipo aprovado
 * .lavish/rede-doca-final.html): um cartão por post, com a autora, o
 * tempo e a categoria discreta (um ponto e o nome, na cor dela), o texto,
 * as fotos e as ações embaixo. O par de fotos chega em leque (LequeFotos);
 * uma foto só ocupa a largura do cartão (FeedFotos, nos 4 formatos). Dois
 * toques numa foto curtem. Curtir solta partículas na cor do tema, o
 * cartão brilha e o número sobe (tudo parado com movimento reduzido).
 */
export function PostCard({
  post,
  onToggleLike,
  onComment,
  onShare,
  onOpenMenu,
  onOpenAutor,
  onRenovarFoto,
  amiga = false,
}: Props) {
  const cat = CATEGORIA_META[post.categoria];
  const nFotos = post.fotos.length;
  const longo = post.texto.length > TEXTO_LONGO;
  const [textoAberto, setTextoAberto] = useState(false);
  const [lequeAberto, setLequeAberto] = useState(false);
  // Cada curtida nova troca a chave: o coração pula, as partículas saem e
  // o cartão brilha de novo do zero.
  const [festa, setFesta] = useState(0);
  const [brilho, setBrilho] = useState<{ x: number; y: number } | null>(null);
  const cartaoRef = useRef<HTMLElement>(null);
  const curtirRef = useRef<HTMLButtonElement>(null);
  const toqueFoto = useRef(0);

  useEffect(() => {
    if (!brilho) return;
    const t = window.setTimeout(() => setBrilho(null), 650);
    return () => window.clearTimeout(t);
  }, [brilho]);

  function curtir() {
    if (!post.curtidoPorMim) {
      setFesta((f) => f + 1);
      const c = cartaoRef.current?.getBoundingClientRect();
      const b = curtirRef.current?.getBoundingClientRect();
      if (c && b && !prefereMenosMovimento()) {
        setBrilho({ x: b.left - c.left + 22, y: b.top - c.top + 22 });
      }
    }
    onToggleLike(post.id);
  }
  /** Duplo toque na foto: só curte (nunca descurte). */
  function curtirDuplo() {
    if (!post.curtidoPorMim) curtir();
  }
  function tocarFotoUnica() {
    const agora = Date.now();
    if (agora - toqueFoto.current < DUPLO_MS) {
      toqueFoto.current = 0;
      curtirDuplo();
    } else {
      toqueFoto.current = agora;
    }
  }

  return (
    <article
      ref={cartaoRef}
      data-post={post.id}
      className="relative"
      style={{
        background: "var(--card-solid)",
        borderRadius: 22,
        padding: 14,
        boxShadow: "inset 0 0 0 1px var(--border-color)",
      }}
    >
      {brilho && (
        <span
          key={`b${festa}`}
          className={s.brilho}
          aria-hidden
          style={
            {
              "--bx": `${brilho.x}px`,
              "--by": `${brilho.y}px`,
            } as React.CSSProperties
          }
        />
      )}

      <header className="flex items-center" style={{ gap: 10 }}>
        <Avatar
          nome={post.autorNome}
          cor={post.autorCor}
          fotoUrl={post.autorFotoUrl}
          tamanho={44}
          onClick={() => onOpenAutor(post.autorId)}
        />
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onOpenAutor(post.autorId)}
            className="block max-w-full truncate text-left"
            style={{
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1.25,
              color: "var(--text)",
            }}
          >
            {post.autorNome}
          </button>
          <p
            className="flex items-center"
            style={{
              gap: 6,
              fontSize: "12.5px",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            <span className="truncate">
              {formatRelativeTime(post.criadoEm)}
              {amiga ? " · amiga" : ""} ·
            </span>
            <span
              data-categoria={post.categoria}
              className="inline-flex items-center shrink-0"
              style={{
                gap: 5,
                fontSize: "11.5px",
                fontWeight: 700,
                // #175: a cor da categoria misturada com --text mantém o
                // matiz e passa no contraste nos 8 temas, claro e escuro.
                color: `color-mix(in srgb, rgb(${cat.rgb}) 62%, var(--text))`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 9,
                  background: `rgb(${cat.rgb})`,
                }}
              />
              {cat.label}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenMenu(post)}
          aria-label="Mais opções"
          className="grid place-items-center shrink-0 rounded-full active:opacity-60"
          style={{ width: 44, height: 44, margin: -4, color: "var(--text)" }}
        >
          <IconeReticencias />
        </button>
      </header>

      {post.texto.trim() && (
        <>
          <p
            data-post-texto=""
            style={{
              marginTop: 10,
              fontSize: 15,
              lineHeight: 1.5,
              color: "var(--text)",
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
              ...(longo && !textoAberto
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }
                : null),
            }}
          >
            {post.texto}
          </p>
          {longo && (
            <button
              type="button"
              onClick={() => setTextoAberto((v) => !v)}
              style={{
                minHeight: 44,
                padding: "0 2px",
                fontSize: 14,
                fontWeight: 800,
                color: "var(--accent-deep-2)",
              }}
            >
              {textoAberto ? "ver menos" : "ver mais"}
            </button>
          )}
        </>
      )}

      {nFotos >= 2 ? (
        <LequeFotos
          fotos={post.fotos}
          autorNome={post.autorNome}
          aberto={lequeAberto}
          onAlternar={() => setLequeAberto((v) => !v)}
          onCurtirDuplo={curtirDuplo}
          onRenovarFoto={onRenovarFoto}
        />
      ) : nFotos === 1 ? (
        <div
          data-foto-unica=""
          onClick={tocarFotoUnica}
          style={{
            marginTop: 12,
            borderRadius: 16,
            overflow: "hidden",
            touchAction: "manipulation",
          }}
        >
          <FeedFotos
            postId={post.id}
            fotos={post.fotos}
            autorNome={post.autorNome}
            onRenovarFoto={onRenovarFoto}
            tom="var(--t-sub)"
          />
        </div>
      ) : null}

      <footer
        className="flex items-center"
        style={{ gap: 2, margin: "8px -6px -6px" }}
      >
        <button
          ref={curtirRef}
          type="button"
          onClick={curtir}
          aria-label="Curtir"
          aria-pressed={post.curtidoPorMim}
          className="relative inline-flex items-center rounded-full active:scale-95"
          style={{
            gap: 6,
            minHeight: 44,
            minWidth: 44,
            padding: "0 8px",
            fontSize: 14,
            fontWeight: 700,
            color: post.curtidoPorMim ? "var(--accent)" : "var(--text-2)",
          }}
        >
          <span
            key={`c${festa}`}
            className={`relative grid place-items-center ${festa > 0 ? s.pulo : ""}`}
          >
            <IconeCoracao filled={post.curtidoPorMim} />
            {festa > 0 && post.curtidoPorMim && <Particulas key={festa} />}
          </span>
          {post.curtidas > 0 && (
            <span key={`n${post.curtidas}`} className={festa > 0 ? s.sobe : ""}>
              {post.curtidas}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onComment(post)}
          aria-label="Comentar"
          className="inline-flex items-center rounded-full active:scale-95"
          style={{
            gap: 6,
            minHeight: 44,
            minWidth: 44,
            padding: "0 8px",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-2)",
          }}
        >
          <IconeComentario />
          {post.comentariosCount > 0 && <span>{post.comentariosCount}</span>}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onShare(post)}
          aria-label="Compartilhar"
          className="grid place-items-center rounded-full active:scale-95"
          style={{ width: 44, height: 44, color: "var(--text-2)" }}
        >
          <IconeEnviar />
        </button>
      </footer>
    </article>
  );
}
