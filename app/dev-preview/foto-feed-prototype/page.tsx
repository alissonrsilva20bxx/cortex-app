"use client";

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PROTÓTIPO DESCARTÁVEL — fotos no feed da Rede                        ║
 * ║  Direção: aparência/interação de app iOS + comportamento estilo      ║
 * ║  Instagram, identidade JobApp.                                       ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Decidido (não é mais pergunta):                                     ║
 * ║   • Foto integrada à largura do card — sangra a padding, SEM borda,  ║
 * ║     sombra ou arredondamento próprio. Não é "galeria numa caixa".    ║
 * ║   • Carrossel = scroll-snap nativo: o dedo arrasta a foto, encaixe   ║
 * ║     preciso entre slides, iOS faz a física; rolagem vertical passa   ║
 * ║     direto (arbitragem de gesto do próprio navegador).               ║
 * ║   • Mobile: sem setas. Setas só no desktop (hover:hover).            ║
 * ║   • Fundo neutro (var(--bg)) só aparece onde a foto não preenche.    ║
 * ║   • Movimento curto; prefers-reduced-motion respeitado (regra        ║
 * ║     global do app + guarda no scrollTo).                             ║
 * ║   • Tipografia do sistema (a do app), safe-area no scroller.         ║
 * ║                                                                      ║
 * ║  Ainda em teste (?v=1|2): posição do indicador de página.            ║
 * ║   v1 = pontinhos sobre a foto (rodapé, leve scrim)                   ║
 * ║   v2 = pontinhos numa faixa fina abaixo da foto (foto 100% limpa)   ║
 * ║                                                                      ║
 * ║  Controles no topo: rede, dimensão da miniatura, reserva, largura —  ║
 * ║  pro teste do salto de layout das fotos legadas.                     ║
 * ║  Validação real: iPhone (Safari / JobApp na tela inicial), não só    ║
 * ║  emulação. Rota isenta de auth pelo prefixo /dev-preview.            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

// ── Limites de proporção (feed ORGÂNICO atual do Instagram, 05/2025) ──
// Paisagem máx 1.91:1 · retrato máx 3:4 (0.75). Quadrado e 4:5 no meio.
// proporção = largura / altura.
const RATIO_MAX = 1.91;
const RATIO_MIN = 3 / 4;
const FALLBACK_RATIO = 1; // reserva neutra p/ foto legada (1:1 = meio da faixa)

const clampRatio = (r: number) => Math.min(RATIO_MAX, Math.max(RATIO_MIN, r));

type Net = "rapida" | "lenta" | "muitoLenta";
type DimMode = "nova" | "legada";
type Reserva = "r45" | "r11" | "lembrar";
type Largura = "mobile" | "desktop";

const NET_MS: Record<Net, number> = {
  rapida: 0,
  lenta: 1500,
  muitoLenta: 6000,
};
const RESERVA_RATIO: Record<"r45" | "r11", number> = { r45: 4 / 5, r11: 1 };

const LKEY = (k: string) => `proto-dim:${k}`;
function lerLembrado(k: string): number | null {
  try {
    const v = localStorage.getItem(LKEY(k));
    return v ? parseFloat(v) : null;
  } catch {
    return null;
  }
}
function gravarLembrado(k: string, r: number) {
  try {
    localStorage.setItem(LKEY(k), String(r));
  } catch {
    /* ignore */
  }
}
function ratioReserva(reserva: Reserva, chave: string): number {
  if (reserva === "lembrar") return lerLembrado(chave) ?? FALLBACK_RATIO;
  return RESERVA_RATIO[reserva];
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// ───────────────────────────── imagens de teste ─────────────────────────────

function svgDataUri(
  w: number,
  h: number,
  label: string,
  c1: string,
  c2: string
) {
  const fs = Math.max(26, Math.round(Math.min(w, h) / 7));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>` +
    `<rect width='${w}' height='${h}' fill='url(#g)'/>` +
    `<rect x='4' y='4' width='${w - 8}' height='${h - 8}' fill='none' stroke='rgba(255,255,255,0.9)' stroke-width='5' stroke-dasharray='3 16' stroke-linecap='round'/>` +
    `<circle cx='18' cy='18' r='11' fill='#fff'/><circle cx='${w - 18}' cy='18' r='11' fill='#fff'/>` +
    `<circle cx='18' cy='${h - 18}' r='11' fill='#fff'/><circle cx='${w - 18}' cy='${h - 18}' r='11' fill='#fff'/>` +
    `<text x='50%' y='50%' fill='#fff' font-family='-apple-system,system-ui,sans-serif' font-weight='800' font-size='${fs}' text-anchor='middle' dominant-baseline='central'>${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

type Foto = {
  w: number;
  h: number;
  principal: string;
  thumb: string;
  legenda: string;
};
function foto(
  w: number,
  h: number,
  label: string,
  c1: string,
  c2: string
): Foto {
  const esc = 400 / Math.max(w, h);
  return {
    w,
    h,
    principal: svgDataUri(w, h, label, c1, c2),
    thumb: svgDataUri(Math.round(w * esc), Math.round(h * esc), label, c1, c2),
    legenda: label,
  };
}

const SINGLES: { texto: string; foto: Foto }[] = [
  {
    texto: "Paisagem 1.91:1 — no limite largo, preenche a largura.",
    foto: foto(1280, 670, "1.91:1", "#6366f1", "#22d3ee"),
  },
  {
    texto: "Paisagem 3:2 — dentro dos limites, encaixe exato.",
    foto: foto(1280, 853, "3:2", "#0ea5e9", "#14b8a6"),
  },
  {
    texto: "Quadrada 1:1 — dentro dos limites.",
    foto: foto(1200, 1200, "1:1", "#8b5cf6", "#ec4899"),
  },
  {
    texto: "Retrato 4:5 — dentro dos limites.",
    foto: foto(1080, 1350, "4:5", "#ec4899", "#f59e0b"),
  },
  {
    texto: "Retrato 3:4 — no limite alto (novo do Instagram, 05/2025).",
    foto: foto(1080, 1440, "3:4", "#f43f5e", "#8b5cf6"),
  },
  {
    texto:
      "Retrato 9:16 — FORA. Contêiner em 3:4, foto inteira, fundo neutro nas laterais.",
    foto: foto(810, 1440, "9:16", "#10b981", "#3b82f6"),
  },
  {
    texto:
      "Paisagem 21:9 — FORA. Contêiner em 1.91:1, foto inteira, fundo neutro em cima/baixo.",
    foto: foto(1280, 548, "21:9", "#f59e0b", "#ef4444"),
  },
];

const CARROSSEIS: { texto: string; fotos: Foto[] }[] = [
  {
    texto:
      "Carrossel — 1ª retrato 3:4 fixa a altura; 2ª paisagem 16:9 aparece inteira, faixa neutra em cima/baixo.",
    fotos: [
      foto(1080, 1440, "1 · 3:4", "#f43f5e", "#8b5cf6"),
      foto(1280, 720, "2 · 16:9", "#0ea5e9", "#22d3ee"),
    ],
  },
  {
    texto:
      "Carrossel — 1ª quadrada; 2ª retrato 4:5 inteira, faixa nas laterais.",
    fotos: [
      foto(1200, 1200, "1 · 1:1", "#8b5cf6", "#ec4899"),
      foto(1080, 1350, "2 · 4:5", "#ec4899", "#f59e0b"),
    ],
  },
  {
    texto:
      "Carrossel — 1ª paisagem 1.91:1 (baixinha); 2ª retrato 3:4 inteira, faixa larga nas laterais.",
    fotos: [
      foto(1280, 670, "1 · 1.91:1", "#6366f1", "#22d3ee"),
      foto(1080, 1440, "2 · 3:4", "#f43f5e", "#8b5cf6"),
    ],
  },
];

// ─────────────────────── carga simulada por foto ────────────────────────────

type Phase = "vazio" | "thumb" | "full";
function useLoadPhases(delayMs: number, ativo: boolean) {
  const [phase, setPhase] = useState<Phase>(delayMs === 0 ? "full" : "vazio");
  useEffect(() => {
    if (!ativo) return;
    if (delayMs === 0) {
      setPhase("full");
      return;
    }
    setPhase("vazio");
    const t1 = setTimeout(() => setPhase("thumb"), Math.round(delayMs * 0.35));
    const t2 = setTimeout(() => setPhase("full"), delayMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [delayMs, ativo]);
  return phase;
}

// ─────────────────────────────── o palco ────────────────────────────────────
// object-contain garante foto inteira; o var(--bg) atrás só aparece se a
// proporção da foto ≠ proporção do contêiner (faixa neutra "onde necessário").

function Stage({
  foto,
  phase,
  measure,
  onThumbRatio,
  onAbrir,
}: {
  foto: Foto;
  phase: Phase;
  measure: DimMode;
  onThumbRatio?: (r: number) => void;
  onAbrir?: () => void;
}) {
  const mostraThumb = phase !== "vazio";
  const mostraFull = phase === "full";
  // tap ≠ swipe: só abre o viewer se o dedo/mouse não andou (o arrasto do
  // carrossel é do scroller nativo; ele não deve disparar o viewer ao soltar).
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!onAbrir || !d) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 10) onAbrir();
      }}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--bg)",
        cursor: onAbrir ? "pointer" : "default",
      }}
    >
      {mostraThumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto.thumb}
          alt={foto.legenda}
          draggable={false}
          onLoad={(e) => {
            if (measure === "legada" && onThumbRatio) {
              const el = e.currentTarget;
              if (el.naturalWidth && el.naturalHeight)
                onThumbRatio(el.naturalWidth / el.naturalHeight);
            }
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: mostraFull ? "none" : "blur(1.5px)",
            opacity: mostraFull ? 0 : 1,
            transition: "opacity 160ms ease-out",
          }}
        />
      )}
      {mostraFull && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto.principal}
          alt={foto.legenda}
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            animation: "protoFade 160ms ease-out",
          }}
        />
      )}
    </div>
  );
}

// ─── hook de altura: proporção conhecida (nova) ou reservada+medida (legada) ─

function useAlturaFoto({
  ratioReal,
  chave,
  dimMode,
  reserva,
  reloadKey,
}: {
  ratioReal: number;
  chave: string;
  dimMode: DimMode;
  reserva: Reserva;
  reloadKey: number;
}) {
  const reservaR = ratioReserva(reserva, chave);
  const [ratio, setRatio] = useState(dimMode === "nova" ? ratioReal : reservaR);
  const [assentou, setAssentou] = useState(dimMode === "nova");

  useEffect(() => {
    setRatio(dimMode === "nova" ? ratioReal : ratioReserva(reserva, chave));
    setAssentou(dimMode === "nova");
  }, [dimMode, ratioReal, reserva, chave, reloadKey]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    setLargura(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const ratioInicial = dimMode === "nova" ? ratioReal : reservaR;
  const reservado = largura > 0 ? Math.round(largura / ratioInicial) : 0;
  const altura = largura > 0 ? Math.round(largura / ratio) : 0;

  const medir = useCallback(
    (r: number) => {
      setAssentou((a) => {
        if (a) return a;
        const rc = clampRatio(r);
        setRatio(rc);
        gravarLembrado(chave, rc);
        return true;
      });
    },
    [chave]
  );

  return { boxRef, altura, reservado, ratio, assentou, medir };
}

// ─────────────────────────────── faixa de foto ──────────────────────────────
// sangra a padding do card (−16). Sem borda / sombra / raio próprio.

const CARD_PAD = 16;

function bleedStyle(altura: number): React.CSSProperties {
  return {
    position: "relative",
    marginLeft: -CARD_PAD,
    marginRight: -CARD_PAD,
    marginTop: 12,
    height: altura || undefined,
    aspectRatio: altura ? undefined : "1 / 1",
    // sem transição de altura: a foto legada assenta de uma vez quando a
    // miniatura chega, sem empurrar o feed com uma animação.
    background: "var(--bg)",
  };
}

function Dots({
  total,
  index,
  variante,
}: {
  total: number;
  index: number;
  variante: "1" | "2";
}) {
  const sobre = variante === "1";
  return (
    <div
      style={
        sobre
          ? {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 8,
              display: "flex",
              justifyContent: "center",
              gap: 5,
              // scrim mínimo só sob os pontos, pra legibilidade em foto clara
              pointerEvents: "none",
            }
          : {
              display: "flex",
              justifyContent: "center",
              gap: 5,
              padding: "8px 0 2px",
            }
      }
    >
      {sobre && (
        <span
          style={{
            position: "absolute",
            bottom: -6,
            width: 8 * total + 5 * (total - 1) + 20,
            height: 22,
            borderRadius: 999,
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.28), transparent 72%)",
          }}
        />
      )}
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: i === index ? 6 : 5,
            height: i === index ? 6 : 5,
            borderRadius: "50%",
            background: sobre
              ? i === index
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.45)"
              : i === index
                ? "var(--text-2)"
                : "var(--text-muted)",
            transition: "all 160ms",
          }}
        />
      ))}
    </div>
  );
}

function DesktopArrows({
  index,
  total,
  onGo,
}: {
  index: number;
  total: number;
  onGo: (dir: number) => void;
}) {
  // só renderiza em ponteiro fino com hover (classe CSS) — nunca no touch
  return (
    <>
      {index > 0 && (
        <button
          className="proto-arrow"
          aria-label="Foto anterior"
          onClick={() => onGo(-1)}
          style={{ ...arrowBase, left: 8 }}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {index < total - 1 && (
        <button
          className="proto-arrow"
          aria-label="Próxima foto"
          onClick={() => onGo(1)}
          style={{ ...arrowBase, right: 8 }}
        >
          <ChevronRight size={20} />
        </button>
      )}
    </>
  );
}

const arrowBase: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  // alvo de toque 44×44 (o glifo aparenta ~32 via padding)
  width: 44,
  height: 44,
  padding: 6,
  borderRadius: "50%",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.4)",
  backgroundClip: "content-box",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

// ──────────────────────────────── carrossel ─────────────────────────────────

function Carousel({
  fotos,
  net,
  dimMode,
  reserva,
  variante,
  reloadKey,
  onAbrir,
}: {
  fotos: Foto[];
  net: Net;
  dimMode: DimMode;
  reserva: Reserva;
  variante: "1" | "2";
  reloadKey: number;
  onAbrir: (i: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [ativados, setAtivados] = useState<Set<number>>(new Set([0]));

  const ratio0 = clampRatio(fotos[0].w / fotos[0].h);
  const { boxRef, altura, reservado, ratio, assentou, medir } = useAlturaFoto({
    ratioReal: ratio0,
    chave: fotos[0].legenda,
    dimMode,
    reserva,
    reloadKey,
  });

  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 1;
        const i = Math.max(
          0,
          Math.min(fotos.length - 1, Math.round(el.scrollLeft / w))
        );
        setIndex(i);
        setAtivados((s) => (s.has(i) ? s : new Set(s).add(i)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [fotos.length]);

  const go = useCallback((dir: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const alvo = Math.round(el.scrollLeft / w) + dir;
    el.scrollTo({
      left: alvo * w,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  return (
    <>
      <div ref={boxRef} style={bleedStyle(altura)}>
        {/* scroller nativo: dedo arrasta, encaixe por scroll-snap, física do
            iOS. touch-action no default → o navegador arbitra horizontal x
            vertical sozinho (rolagem da página nunca trava).
            overscroll-behavior-x: contain é só uma dica — NÃO é garantia de
            bloqueio do gesto "Voltar" do iOS; isso fica pra teste no aparelho. */}
        <div
          ref={scrollerRef}
          className="proto-scroller"
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
          {fotos.map((f, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                minWidth: "100%",
                height: "100%",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
              }}
            >
              <SlideStage
                foto={f}
                net={net}
                dimMode={dimMode}
                ativo={ativados.has(i)}
                onThumbRatio={i === 0 ? medir : undefined}
                onAbrir={() => onAbrir(i)}
              />
            </div>
          ))}
        </div>

        <DesktopArrows index={index} total={fotos.length} onGo={go} />
        {variante === "1" && (
          <Dots total={fotos.length} index={index} variante="1" />
        )}
      </div>

      {variante === "2" && (
        <Dots total={fotos.length} index={index} variante="2" />
      )}

      <StateLine
        style={{ marginTop: 8 }}
        linhas={[
          `slide ${index + 1}/${fotos.length} · principais: [${[...ativados]
            .sort()
            .map((n) => n + 1)
            .join(
              ", "
            )}] · ratio ${ratio.toFixed(3)}${assentou ? "" : " (reserva)"}`,
          dimMode === "legada"
            ? `reservado ${reservado}px → final ${altura}px · Δ ${altura - reservado > 0 ? "+" : ""}${altura - reservado}px`
            : `altura ${altura}px · sem salto (dimensão no nome)`,
        ]}
      />
    </>
  );
}

function SlideStage({
  foto,
  net,
  dimMode,
  ativo,
  onThumbRatio,
  onAbrir,
}: {
  foto: Foto;
  net: Net;
  dimMode: DimMode;
  ativo: boolean;
  onThumbRatio?: (r: number) => void;
  onAbrir: () => void;
}) {
  const phaseFull = useLoadPhases(NET_MS[net], ativo);
  const phase: Phase = ativo ? phaseFull : "thumb";
  return (
    <Stage
      foto={foto}
      phase={phase}
      measure={dimMode}
      onThumbRatio={onThumbRatio}
      onAbrir={onAbrir}
    />
  );
}

// ─────────────────────────────── foto única ─────────────────────────────────

function SinglePhoto({
  foto,
  net,
  dimMode,
  reserva,
  reloadKey,
  onAbrir,
}: {
  foto: Foto;
  net: Net;
  dimMode: DimMode;
  reserva: Reserva;
  reloadKey: number;
  onAbrir: () => void;
}) {
  const phase = useLoadPhases(NET_MS[net], true);
  const ratioReal = clampRatio(foto.w / foto.h);
  const { boxRef, altura, reservado, ratio, assentou, medir } = useAlturaFoto({
    ratioReal,
    chave: foto.legenda,
    dimMode,
    reserva,
    reloadKey,
  });

  return (
    <>
      <div ref={boxRef} style={bleedStyle(altura)}>
        <Stage
          foto={foto}
          phase={phase}
          measure={dimMode}
          onThumbRatio={medir}
          onAbrir={onAbrir}
        />
      </div>
      <StateLine
        style={{ marginTop: 8 }}
        linhas={[
          `fase ${phase} · ratio ${ratio.toFixed(3)}${assentou ? "" : " (reserva)"}`,
          dimMode === "legada"
            ? `reservado ${reservado}px → final ${altura}px · Δ ${altura - reservado > 0 ? "+" : ""}${altura - reservado}px`
            : `altura ${altura}px · sem salto (dimensão no nome)`,
        ]}
      />
    </>
  );
}

// ─────────────────────────────── card do feed ───────────────────────────────

function FeedCard({
  texto,
  foto,
  fotos,
  ...rest
}: {
  texto: string;
  foto?: Foto;
  fotos?: Foto[];
  net: Net;
  dimMode: DimMode;
  reserva: Reserva;
  variante: "1" | "2";
  reloadKey: number;
}) {
  const [viewer, setViewer] = useState<number | null>(null);

  return (
    <>
      <GlassCard radius="lg" style={{ padding: CARD_PAD, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#8b5cf6,#ec4899)",
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}
            >
              Autora de teste
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              agora
            </div>
          </div>
        </div>

        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "var(--text-2)",
            marginTop: 12,
          }}
        >
          {texto}
        </p>

        {foto && (
          <SinglePhoto foto={foto} {...rest} onAbrir={() => setViewer(0)} />
        )}
        {fotos && (
          <Carousel fotos={fotos} {...rest} onAbrir={(i) => setViewer(i)} />
        )}

        <div
          style={{
            display: "flex",
            gap: 18,
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--divider)",
            color: "var(--text-muted)",
          }}
        >
          <Heart size={18} />
          <MessageCircle size={18} />
          <Share2 size={18} />
        </div>
      </GlassCard>

      {viewer !== null && (
        <FakeViewer
          fotos={fotos ?? (foto ? [foto] : [])}
          inicial={viewer}
          onFechar={() => setViewer(null)}
        />
      )}
    </>
  );
}

/** Stand-in do FotoViewer real só pra provar "tocar abre / fechar volta ao
 * mesmo ponto". O FotoViewer de produção (components/rede/FotoViewer.tsx)
 * já existe e será reaproveitado — aqui é casca. */
function FakeViewer({
  fotos,
  inicial,
  onFechar,
}: {
  fotos: Foto[];
  inicial: number;
  onFechar: () => void;
}) {
  const [i, setI] = useState(inicial);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    const ov = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = ov;
    };
  }, [onFechar]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#0b0b0d",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top,0px)",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
      }}
    >
      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          color: "#fff",
          fontSize: 14,
        }}
      >
        <span>{fotos.length > 1 ? `${i + 1}/${fotos.length}` : ""}</span>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fotos[i].principal}
          alt=""
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>
      {fotos.length > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            padding: 12,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setI((x) => Math.max(0, x - 1));
            }}
            style={{
              background: "rgba(255,255,255,0.14)",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setI((x) => Math.min(fotos.length - 1, x + 1));
            }}
            style={{
              background: "rgba(255,255,255,0.14)",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── util / controles ─────────────────────────────

function StateLine({
  linhas,
  style,
}: {
  linhas: string[];
  style?: React.CSSProperties;
}) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "6px 8px",
        borderRadius: 6,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--divider)",
        color: "var(--text-2)",
        fontSize: 10.5,
        lineHeight: 1.45,
        fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
        whiteSpace: "pre-wrap",
        ...style,
      }}
    >
      {linhas.join("\n")}
    </pre>
  );
}

function Segment<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { v: T; l: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 9.5,
          color: "var(--text-muted)",
          fontWeight: 700,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: 2,
          borderRadius: 8,
          background: "rgba(255,255,255,0.05)",
        }}
      >
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              minHeight: 44,
              padding: "5px 10px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              background: value === o.v ? "var(--accent)" : "transparent",
              color: value === o.v ? "#000" : "var(--text-2)",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────── página ────────────────────────────────────

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const variante: "1" | "2" = params.get("v") === "2" ? "2" : "1";

  const [net, setNet] = useState<Net>("lenta");
  const [dimMode, setDimMode] = useState<DimMode>("legada");
  const [reserva, setReserva] = useState<Reserva>("r11");
  const [largura, setLargura] = useState<Largura>("mobile");
  const [reloadKey, setReloadKey] = useState(0);

  function setV(v: "1" | "2") {
    const p = new URLSearchParams(params.toString());
    p.set("v", v);
    router.replace(`/dev-preview/foto-feed-prototype?${p.toString()}` as never);
  }
  function esquecerDims() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("proto-dim:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    setReloadKey((k) => k + 1);
  }

  const maxW = largura === "mobile" ? 430 : 720;
  const common = { net, dimMode, reserva, variante, reloadKey };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        paddingBottom: "calc(80px + env(safe-area-inset-bottom,0px))",
      }}
    >
      <style>{`
        @keyframes protoFade { from { opacity: 0 } to { opacity: 1 } }
        .proto-scroller::-webkit-scrollbar { display: none; }
        .proto-arrow { display: none; }
        @media (hover: hover) and (pointer: fine) {
          .proto-arrow { display: flex; }
        }
      `}</style>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          padding: "10px 14px calc(10px + env(safe-area-inset-top,0px))",
          background: "rgba(10,10,12,0.94)",
          borderBottom: "1px solid var(--border-color)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Segment
          label="INDICADOR (?v)"
          value={variante}
          onChange={setV}
          options={[
            { v: "1", l: "Sobre a foto" },
            { v: "2", l: "Abaixo" },
          ]}
        />
        <Segment
          label="REDE"
          value={net}
          onChange={setNet}
          options={[
            { v: "rapida", l: "Rápida" },
            { v: "lenta", l: "Lenta" },
            { v: "muitoLenta", l: "Muito lenta" },
          ]}
        />
        <Segment
          label="MINIATURA"
          value={dimMode}
          onChange={setDimMode}
          options={[
            { v: "nova", l: "Nova" },
            { v: "legada", l: "Legada" },
          ]}
        />
        <Segment
          label="RESERVA (LEGADA)"
          value={reserva}
          onChange={setReserva}
          options={[
            { v: "r45", l: "4:5" },
            { v: "r11", l: "1:1" },
            { v: "lembrar", l: "Última" },
          ]}
        />
        <Segment
          label="LARGURA"
          value={largura}
          onChange={setLargura}
          options={[
            { v: "mobile", l: "Mobile" },
            { v: "desktop", l: "Desktop" },
          ]}
        />
        <button onClick={() => setReloadKey((k) => k + 1)} style={btn}>
          ↻ Recarregar
        </button>
        {reserva === "lembrar" && (
          <button onClick={esquecerDims} style={{ ...btn, opacity: 0.7 }}>
            Esquecer dims
          </button>
        )}
      </div>

      <div style={{ maxWidth: maxW, margin: "0 auto", padding: "14px 12px" }}>
        <p
          style={{
            fontSize: 11.5,
            color: "var(--text-muted)",
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          <strong style={{ color: "var(--text-2)" }}>
            v{variante} — indicador{" "}
            {variante === "1" ? "sobre a foto" : "abaixo da foto"}
          </strong>
          <br />
          Foto sangra a largura do card, sem borda/sombra/raio. Arraste a foto
          do carrossel com o dedo; a rolagem vertical passa direto. Setas só no
          desktop. Fundo neutro só onde a foto não preenche. Foto legada:
          reserva um tamanho e a altura assenta <em>de uma vez</em> quando a
          miniatura chega (sem animação de altura). Soltar o dedo depois de um
          swipe NÃO abre o visualizador — só um toque sem arrasto. Bolinhas de
          canto = prova de foto inteira. Linha <code>mono</code> = estado (fase,
          proporção, salto em px). Gesto &quot;Voltar&quot; do iOS: teste no
          aparelho.
        </p>

        {SINGLES.map((s, i) => (
          <FeedCard
            key={`s${i}-${reloadKey}`}
            texto={s.texto}
            foto={s.foto}
            {...common}
          />
        ))}
        {CARROSSEIS.map((c, i) => (
          <FeedCard
            key={`c${i}-${reloadKey}`}
            texto={c.texto}
            fotos={c.fotos}
            {...common}
          />
        ))}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  minHeight: 44,
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid var(--border-color)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontWeight: 700,
  fontSize: 11.5,
  cursor: "pointer",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
