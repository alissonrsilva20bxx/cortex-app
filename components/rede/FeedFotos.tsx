"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { FotoPost } from "@/lib/rede/feed";

/**
 * Fotos no feed da Rede -- foto grande no próprio card (não só miniatura),
 * comportamento estilo Instagram, interação de app iOS:
 *
 * - A foto sangra a largura do card (a padding do `PostCard`), SEM borda,
 *   sombra ou arredondamento próprio -- não é "uma galeria numa caixa".
 * - Miniatura entra imediata como placeholder; a principal carrega sob
 *   demanda (`loading="lazy"`) com crossfade curto. O espaço é reservado
 *   antes: proporção pelas dimensões que vêm no nome da miniatura
 *   (`foto.largura/altura`) ou, em foto legada, medindo a miniatura ao
 *   carregar -- aí a altura assenta DE UMA VEZ (sem animação, pra não
 *   empurrar o feed).
 * - 2 fotos: carrossel com scroll-snap NATIVO (o dedo arrasta a foto, a
 *   física é a do iOS, encaixe preciso entre slides). A rolagem vertical
 *   passa direto -- quem arbitra o eixo do gesto é o navegador. Altura fixa
 *   pela 1ª foto; a 2ª aparece inteira (`object-contain`) com fundo neutro
 *   onde não preenche.
 * - Sem setas no touch: as setas só existem sob `@media (hover:hover) and
 *   (pointer:fine)` (ver `.feed-foto-seta` em globals.css). Indicador de
 *   página discreto, ABAIXO da foto.
 * - Tocar abre o `FotoViewer` (opcional) -- mas soltar o dedo depois de um
 *   swipe NÃO abre: só um toque sem arrasto (limiar de 10px).
 * - Movimento curto; `prefers-reduced-motion` já é amortecido pela regra
 *   global do app + guarda no `scrollTo`.
 */

// Feed ORGÂNICO do Instagram (mudança de 05/2025): paisagem no máximo
// 1.91:1, retrato no máximo 3:4 (0.75). Quadrado e 4:5 caem no meio.
// proporção = largura / altura.
const RATIO_MAX = 1.91;
const RATIO_MIN = 3 / 4;
// Reserva neutra da foto legada (sem dimensão no nome) até medir a miniatura.
const RATIO_RESERVA = 1;

const clampRatio = (r: number) => Math.min(RATIO_MAX, Math.max(RATIO_MIN, r));

function ratioDe(foto: FotoPost): number | null {
  if (!foto.largura || !foto.altura) return null;
  return clampRatio(foto.largura / foto.altura);
}

function prefereMovimentoReduzido() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

interface Props {
  fotos: FotoPost[];
  autorNome: string;
  /** Renova a URL assinada (5min) de um path -- miniatura ou principal.
   * Devolve URL nova ou `null` se a renovação falhar (ex.: bloqueio mudou). */
  onRenovarFoto: (path: string) => Promise<string | null>;
  /** Abre o visualizador em tela cheia na foto `indice`. */
  onAbrirViewer: (fotos: FotoPost[], indice: number) => void;
}

export function FeedFotos({
  fotos,
  autorNome,
  onRenovarFoto,
  onAbrirViewer,
}: Props) {
  if (fotos.length === 0) return null;
  if (fotos.length === 1) {
    return (
      <UmaFoto
        foto={fotos[0]}
        autorNome={autorNome}
        onRenovarFoto={onRenovarFoto}
        onAbrir={() => onAbrirViewer(fotos, 0)}
      />
    );
  }
  return (
    <Carrossel
      fotos={fotos}
      autorNome={autorNome}
      onRenovarFoto={onRenovarFoto}
      onAbrirViewer={onAbrirViewer}
    />
  );
}

// ─── hook de altura: proporção conhecida, ou reservada + medida uma vez ───

function useAltura(foto0: FotoPost) {
  const conhecido = ratioDe(foto0);
  const [ratio, setRatio] = useState<number>(conhecido ?? RATIO_RESERVA);
  const medido = useRef(conhecido != null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setLargura(entry.contentRect.width)
    );
    ro.observe(el);
    setLargura(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const medirDaMiniatura = useCallback((w: number, h: number) => {
    if (medido.current || !w || !h) return;
    medido.current = true;
    setRatio(clampRatio(w / h));
  }, []);

  return {
    boxRef,
    ratio,
    altura: largura > 0 ? Math.round(largura / ratio) : 0,
    medirDaMiniatura,
  };
}

const bleed = (altura: number, ratio: number): React.CSSProperties => ({
  position: "relative",
  // sangra a padding do PostCard (`p-4` = 16px) -- foto na largura do card
  marginLeft: -16,
  marginRight: -16,
  marginTop: 12,
  height: altura || undefined,
  aspectRatio: altura ? undefined : String(ratio),
  overflow: "hidden",
  background: "var(--bg)", // fundo neutro, só visível onde a foto não preenche
});

// ─────────────────────────────── palco ──────────────────────────────────

function PhotoStage({
  foto,
  alt,
  onRenovarFoto,
  onAbrir,
  onMedirMiniatura,
}: {
  foto: FotoPost;
  alt: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
  onAbrir: () => void;
  onMedirMiniatura?: (w: number, h: number) => void;
}) {
  const [thumbUrl, setThumbUrl] = useState(foto.thumbUrl);
  const [url, setUrl] = useState(foto.url);
  const [principalOk, setPrincipalOk] = useState(false);
  const [principalFalhou, setPrincipalFalhou] = useState(false);
  const down = useRef<{ x: number; y: number } | null>(null);

  // se a URL mudar (renovação vinda do pai), re-tenta
  useEffect(() => setThumbUrl(foto.thumbUrl), [foto.thumbUrl]);
  useEffect(() => {
    setUrl(foto.url);
    setPrincipalFalhou(false);
  }, [foto.url]);

  async function renovarThumb() {
    const nova = await onRenovarFoto(foto.thumbPath);
    if (nova) setThumbUrl(nova);
  }
  async function renovarPrincipal() {
    setPrincipalFalhou(false);
    const nova = await onRenovarFoto(foto.path);
    if (nova) {
      setUrl(nova);
      setPrincipalOk(false);
    } else {
      setPrincipalFalhou(true);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${alt}`}
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d) return;
        // só é "toque" se o dedo/mouse não andou -- swipe do carrossel não abre
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 10) onAbrir();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        cursor: "pointer",
        outline: "none",
      }}
    >
      {/* miniatura -- placeholder, some no crossfade quando a principal carrega */}
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de Storage */}
      <img
        src={thumbUrl}
        alt=""
        aria-hidden
        draggable={false}
        onLoad={(e) =>
          onMedirMiniatura?.(
            e.currentTarget.naturalWidth,
            e.currentTarget.naturalHeight
          )
        }
        onError={() => void renovarThumb()}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: principalOk ? 0 : 1,
          transition: "opacity 160ms ease-out",
        }}
      />

      {/* principal -- carrega sob demanda (lazy); nunca antecipada de todos */}
      {!principalFalhou && url && (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada de Storage
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setPrincipalOk(true)}
          onError={() => void renovarPrincipal()}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: principalOk ? 1 : 0,
            transition: "opacity 160ms ease-out",
          }}
        />
      )}

      {principalFalhou && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            void renovarPrincipal();
          }}
          className="feed-foto-retry"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 12,
            transform: "translateX(-50%)",
            minHeight: 44,
            padding: "8px 14px",
            borderRadius: 999,
            border: "none",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Recarregar a foto
        </button>
      )}
    </div>
  );
}

// ───────────────────────────── uma foto ─────────────────────────────────

function UmaFoto({
  foto,
  autorNome,
  onRenovarFoto,
  onAbrir,
}: {
  foto: FotoPost;
  autorNome: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
  onAbrir: () => void;
}) {
  const { boxRef, ratio, altura, medirDaMiniatura } = useAltura(foto);
  return (
    <div ref={boxRef} style={bleed(altura, ratio)}>
      <PhotoStage
        foto={foto}
        alt={`Foto da publicação de ${autorNome}`}
        onRenovarFoto={onRenovarFoto}
        onAbrir={onAbrir}
        onMedirMiniatura={medirDaMiniatura}
      />
    </div>
  );
}

// ─────────────────────────────── carrossel ──────────────────────────────

function Carrossel({
  fotos,
  autorNome,
  onRenovarFoto,
  onAbrirViewer,
}: {
  fotos: FotoPost[];
  autorNome: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
  onAbrirViewer: (fotos: FotoPost[], indice: number) => void;
}) {
  const { boxRef, ratio, altura, medirDaMiniatura } = useAltura(fotos[0]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);

  // índice = slide encaixado (posição de scroll ÷ largura). rAF debounce.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const aoRolar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        setIndice(
          Math.max(0, Math.min(fotos.length - 1, Math.round(el.scrollLeft / w)))
        );
      });
    };
    el.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      el.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(raf);
    };
  }, [fotos.length]);

  const irPara = useCallback((dir: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({
      left: (Math.round(el.scrollLeft / w) + dir) * w,
      behavior: prefereMovimentoReduzido() ? "auto" : "smooth",
    });
  }, []);

  return (
    <>
      <div ref={boxRef} style={bleed(altura, ratio)}>
        {/* scroller nativo: dedo arrasta, encaixe por scroll-snap, física do
            iOS. touch-action no default → o navegador arbitra o eixo do
            gesto (rolagem vertical da lista nunca trava).
            overscroll-behavior-x: contain é só uma dica -- NÃO garante bloqueio
            do gesto "Voltar" do iOS (a validar no aparelho). */}
        <div
          ref={scrollerRef}
          className="feed-foto-scroller"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            overscrollBehaviorX: "contain",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {fotos.map((foto, i) => (
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
              <PhotoStage
                foto={foto}
                alt={`Foto ${foto.ordem} da publicação de ${autorNome}`}
                onRenovarFoto={onRenovarFoto}
                onAbrir={() => onAbrirViewer(fotos, i)}
                onMedirMiniatura={i === 0 ? medirDaMiniatura : undefined}
              />
            </div>
          ))}
        </div>

        {/* setas -- só ponteiro fino + hover (nunca no touch), alvo 44×44 */}
        {indice > 0 && (
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => irPara(-1)}
            className="feed-foto-seta"
            style={{ ...setaBase, left: 4 }}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {indice < fotos.length - 1 && (
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => irPara(1)}
            className="feed-foto-seta"
            style={{ ...setaBase, right: 4 }}
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* indicador de página -- discreto, ABAIXO da foto */}
      <div
        aria-hidden
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 5,
          paddingTop: 8,
        }}
      >
        {fotos.map((f, i) => (
          <span
            key={f.ordem}
            style={{
              width: i === indice ? 6 : 5,
              height: i === indice ? 6 : 5,
              borderRadius: "50%",
              background: i === indice ? "var(--text-2)" : "var(--text-muted)",
              transition: "all 160ms",
            }}
          />
        ))}
      </div>
    </>
  );
}

const setaBase: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  // alvo de toque 44×44; o glifo aparenta ~32 via padding + background-clip
  width: 44,
  height: 44,
  padding: 6,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.4)",
  backgroundClip: "content-box",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};
