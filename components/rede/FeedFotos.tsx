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
import { resolveScrollBehavior } from "@/lib/rede/chatUi";
import {
  lembrarProporcao,
  proporcaoLembrada,
} from "@/lib/rede/fotoRatioMemoria";

/**
 * Fotos no feed da Rede -- foto grande no próprio card (não só miniatura),
 * comportamento estilo Instagram, interação de app iOS:
 *
 * - A foto sangra a largura do card (a padding do `PostCard`), SEM borda,
 *   sombra ou arredondamento próprio -- não é "uma galeria numa caixa".
 * - Miniatura entra imediata como placeholder; a principal carrega sob
 *   demanda com crossfade curto. A `<img>` da principal só é MONTADA
 *   quando o card entra na viewport (IntersectionObserver, margem de
 *   200px) E -- no carrossel -- o slide foi ativado. Sem `<img>` não há
 *   requisição de rede: o feed nunca baixa a principal de posts longe da
 *   viewport nem de slides que a pessoa não deslizou até. (`loading="lazy"`
 *   fica como reforço, mas o limiar dele é fuzzy demais pra confiar num
 *   feed curto.) O espaço é reservado
 *   antes: proporção pelas dimensões que vêm no nome da miniatura
 *   (`foto.largura/altura`); em foto legada, pela proporção lembrada de
 *   uma visão anterior (`lib/rede/fotoRatioMemoria`) e, se não houver,
 *   medindo a miniatura ao carregar -- aí a altura assenta DE UMA VEZ
 *   (sem animação, pra não empurrar o feed).
 * - 2 fotos: carrossel com scroll-snap NATIVO (o dedo arrasta a foto, a
 *   física é a do iOS, encaixe preciso entre slides). A rolagem vertical
 *   passa direto -- quem arbitra o eixo do gesto é o navegador. Altura fixa
 *   pela 1ª foto; a 2ª aparece inteira (`object-contain`) com fundo neutro
 *   onde não preenche.
 * - Sem setas no touch: as setas só existem sob `@media (hover:hover) and
 *   (pointer:fine)` (ver `.feed-foto-seta` em globals.css) e navegam o
 *   carrossel (não abrem nada). Indicador de página discreto, ABAIXO da foto.
 * - A foto NÃO é interativa: tocar não abre modal/fullscreen/página/
 *   visualizador. Fica no próprio feed. Sem `role="button"`, sem foco por
 *   teclado, sem cursor de clique. (Decisão de 2026-09-10: o visualizador
 *   interno no feed foi retirado -- ver PR #112.)
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
}

export function FeedFotos({ fotos, autorNome, onRenovarFoto }: Props) {
  if (fotos.length === 0) return null;
  if (fotos.length === 1) {
    return (
      <UmaFoto
        foto={fotos[0]}
        autorNome={autorNome}
        onRenovarFoto={onRenovarFoto}
      />
    );
  }
  return (
    <Carrossel
      fotos={fotos}
      autorNome={autorNome}
      onRenovarFoto={onRenovarFoto}
    />
  );
}

// ─── hook de altura: proporção conhecida, ou reservada + medida uma vez ───

function useAltura(foto0: FotoPost) {
  // 1) dimensão no nome da miniatura (foto nova) → proporção exata, 0 salto.
  // 2) foto legada: proporção lembrada de uma visão anterior (0 salto na
  //    2ª vez em diante). 3) senão: reserva 1:1 e mede a miniatura (1 salto).
  const inicial = () => {
    const doNome = ratioDe(foto0);
    if (doNome != null) return { ratio: doNome, medido: true };
    const lembrada = proporcaoLembrada(foto0.thumbPath);
    if (lembrada != null) return { ratio: clampRatio(lembrada), medido: true };
    return { ratio: RATIO_RESERVA, medido: false };
  };
  const [seed] = useState(inicial);
  const [ratio, setRatio] = useState<number>(seed.ratio);
  const medido = useRef(seed.medido);
  const boxRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  // a principal só é montada quando o card se aproxima da viewport
  const [naViewport, setNaViewport] = useState(false);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setLargura(entry.contentRect.width)
    );
    ro.observe(el);
    setLargura(el.getBoundingClientRect().width);

    if (typeof IntersectionObserver === "undefined") {
      setNaViewport(true); // sem IO (jsdom/SSR) não adia
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setNaViewport(true);
            io.disconnect(); // uma vez perto, fica -- não descarrega ao rolar
          }
        },
        { rootMargin: "200px 0px" }
      );
      io.observe(el);
      return () => {
        ro.disconnect();
        io.disconnect();
      };
    }
    return () => ro.disconnect();
  }, []);

  const medirDaMiniatura = useCallback(
    (w: number, h: number) => {
      if (medido.current || !w || !h) return;
      medido.current = true;
      const r = clampRatio(w / h);
      setRatio(r);
      lembrarProporcao(foto0.thumbPath, r);
    },
    [foto0.thumbPath]
  );

  return {
    boxRef,
    ratio,
    naViewport,
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
  onMedirMiniatura,
  /** monta a `<img>` da principal? Falso p/ slide de carrossel ainda não
   * ativado -- sem `<img>` não há requisição de rede pra essa foto. */
  renderPrincipal = true,
}: {
  foto: FotoPost;
  alt: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
  onMedirMiniatura?: (w: number, h: number) => void;
  renderPrincipal?: boolean;
}) {
  const [thumbUrl, setThumbUrl] = useState(foto.thumbUrl);
  const [url, setUrl] = useState(foto.url);
  const [principalOk, setPrincipalOk] = useState(false);
  const [principalFalhou, setPrincipalFalhou] = useState(false);
  // trava de renovação automática: o `onError` da <img> pede UMA re-assinatura
  // e só volta a pedir depois de um `onLoad` bem-sucedido ou de uma URL nova
  // vinda do pai. Sem isso, uma URL que assina mas não carrega (blob some,
  // relógio torto) faz `onError` -> re-assina -> `onError` em loop.
  const renovandoThumb = useRef(false);
  const renovandoPrincipal = useRef(false);

  // URL nova vinda do pai (ou 1ª montagem): destrava e re-tenta
  useEffect(() => {
    renovandoThumb.current = false;
    setThumbUrl(foto.thumbUrl);
  }, [foto.thumbUrl]);
  useEffect(() => {
    renovandoPrincipal.current = false;
    setUrl(foto.url);
    setPrincipalFalhou(false);
  }, [foto.url]);

  async function renovarThumb() {
    if (renovandoThumb.current) return;
    renovandoThumb.current = true;
    const nova = await onRenovarFoto(foto.thumbPath);
    if (nova) setThumbUrl(nova);
    // a trava só cai no `onLoad` da miniatura (ou numa URL nova do pai):
    // se a re-assinada também falhar, não re-assina de novo.
  }
  async function renovarPrincipal({ manual = false } = {}) {
    if (renovandoPrincipal.current && !manual) return;
    renovandoPrincipal.current = true;
    setPrincipalFalhou(false);
    const nova = await onRenovarFoto(foto.path);
    if (nova) {
      setUrl(nova);
      setPrincipalOk(false);
    } else {
      setPrincipalFalhou(true);
    }
  }
  // toque no botão "Recarregar a foto": re-assina as duas, sempre (o manual
  // ignora a trava automática).
  function recarregarManual() {
    renovandoThumb.current = false;
    void renovarThumb();
    void renovarPrincipal({ manual: true });
  }

  return (
    // Container NÃO interativo: a foto vive no feed, tocar não abre nada.
    <div style={{ position: "absolute", inset: 0 }}>
      {/* miniatura -- placeholder, some no crossfade quando a principal carrega */}
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de Storage */}
      <img
        src={thumbUrl}
        alt=""
        aria-hidden
        draggable={false}
        onLoad={(e) => {
          renovandoThumb.current = false;
          onMedirMiniatura?.(
            e.currentTarget.naturalWidth,
            e.currentTarget.naturalHeight
          );
        }}
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

      {/* principal -- só monta quando o slide está ativo (carrossel) e o
          card entra na viewport (`loading="lazy"`). Sem `<img>` = 0 rede. */}
      {renderPrincipal && !principalFalhou && url && (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada de Storage
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => {
            renovandoPrincipal.current = false;
            setPrincipalOk(true);
          }}
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
            recarregarManual();
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
}: {
  foto: FotoPost;
  autorNome: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
}) {
  const { boxRef, ratio, altura, naViewport, medirDaMiniatura } =
    useAltura(foto);
  return (
    <div ref={boxRef} style={bleed(altura, ratio)}>
      <PhotoStage
        foto={foto}
        alt={`Foto da publicação de ${autorNome}`}
        onRenovarFoto={onRenovarFoto}
        onMedirMiniatura={medirDaMiniatura}
        renderPrincipal={naViewport}
      />
    </div>
  );
}

// ─────────────────────────────── carrossel ──────────────────────────────

function Carrossel({
  fotos,
  autorNome,
  onRenovarFoto,
}: {
  fotos: FotoPost[];
  autorNome: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
}) {
  const { boxRef, ratio, altura, naViewport, medirDaMiniatura } = useAltura(
    fotos[0]
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);
  // slides cuja principal já pode ser MONTADA -- a 1ª desde o início, as
  // outras só quando a pessoa desliza até elas. Sem `<img>` = nenhum GET.
  const [ativados, setAtivados] = useState<ReadonlySet<number>>(
    () => new Set([0])
  );

  // índice = slide encaixado (posição de scroll ÷ largura). rAF debounce.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const aoRolar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const i = Math.max(
          0,
          Math.min(fotos.length - 1, Math.round(el.scrollLeft / w))
        );
        setIndice(i);
        setAtivados((prev) => (prev.has(i) ? prev : new Set([...prev, i])));
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
      behavior: resolveScrollBehavior(prefereMovimentoReduzido()),
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
                onMedirMiniatura={i === 0 ? medirDaMiniatura : undefined}
                renderPrincipal={naViewport && ativados.has(i)}
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

// Sem `display`/`alignItems`/`justifyContent` aqui de propósito: um `display`
// inline venceria a media query `(hover:hover) and (pointer:fine)` de
// `.feed-foto-seta` (globals.css) por especificidade e as setas apareceriam
// no touch. Quem liga o `display: flex` (e centra o glifo) é aquela regra.
const setaBase: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  // alvo de toque 44×44; o glifo aparenta ~32 via padding + background-clip
  width: 44,
  height: 44,
  padding: 6,
  borderRadius: "50%",
  background: "rgba(0,0,0,0.4)",
  backgroundClip: "content-box",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};
