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
import { lembrarSlide, slideLembrado } from "@/lib/rede/redeCache";
import {
  alturaDoQuadro,
  encaixeDoSlide,
  encaixeNoQuadro,
  formatoMaisProximo,
  type Encaixe,
  type Formato,
} from "@/lib/rede/formatoFoto";

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
 * - Mais de 1 foto: carrossel com scroll-snap NATIVO (o dedo arrasta a
 *   foto, a física é a do iOS, encaixe preciso entre slides). A rolagem
 *   vertical passa direto -- quem arbitra o eixo do gesto é o navegador.
 *   Aceita N fotos (o banco hoje guarda até 2 por post, migration 0028).
 * - Setas em qualquer aparelho (proposta "Três abas": o dedo desliza OU os
 *   botões), contador 1/N no canto e bolinhas ABAIXO da foto. Setas,
 *   contador e teclado só NAVEGAM o carrossel, nunca abrem nada.
 * - A foto NÃO é interativa: tocar não abre modal/fullscreen/página/
 *   visualizador. Fica no próprio feed. Sem `role="button"` nem cursor de
 *   clique no palco. (Decisão de 2026-09-10: o visualizador interno no feed
 *   foi retirado -- ver PR #112.) O único foco é o do carrossel, para as
 *   setas do teclado trocarem a foto.
 * - Movimento curto; `prefers-reduced-motion` já é amortecido pela regra
 *   global do app + guarda no `scrollTo`.
 *
 * Formatos do Instagram (proposta "Três abas", proporções confirmadas em
 * feed-proporcoes.html; regra em lib/rede/formatoFoto.ts): o quadro é
 * sempre um dos 4 formatos -- 4:5, 1:1, 16:9 ou 1,91:1 -- o mais próximo da
 * foto, com a altura em pixels inteiros (390 → 488/390/219/204). A foto é
 * recortada centrada, só nas bordas; se o recorte tiraria a área segura,
 * ela aparece inteira com o próprio fundo desfocado na sobra. No carrossel
 * o quadro é o da 1ª foto, e um slide de outra proporção aparece inteiro.
 * Setas (alvo 44, em qualquer aparelho), contador 1/N, bolinhas e as
 * setas do teclado navegam o carrossel; o dedo desliza pelo scroll-snap.
 */

// Reserva neutra da foto legada (sem dimensão no nome) até medir a miniatura.
const RATIO_RESERVA = 1;

/** Proporção NATIVA da foto pelo nome da miniatura (sem limitar: quem
 * decide o quadro é `formatoMaisProximo`). */
function ratioDe(foto: FotoPost): number | null {
  if (!foto.largura || !foto.altura) return null;
  return foto.largura / foto.altura;
}

// Exportado (ticket #139): ProfilePhotoViewer.tsx reusa em vez de
// reescrever a mesma expressão de matchMedia.
export function prefereMovimentoReduzido() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

interface Props {
  /** Id do post -- chave da memória de slide do carrossel (o slide ativo
   * sobrevive ao remount do PIN). */
  postId: string;
  fotos: FotoPost[];
  autorNome: string;
  /** Renova a URL assinada (5min) de um path -- miniatura ou principal.
   * Devolve URL nova ou `null` se a renovação falhar (ex.: bloqueio mudou). */
  onRenovarFoto: (path: string) => Promise<string | null>;
  /** Tom do espaço da foto; a referência alterna entre um post e o seguinte. */
  tom: string;
}

export function FeedFotos({
  postId,
  fotos,
  autorNome,
  onRenovarFoto,
  tom,
}: Props) {
  if (fotos.length === 0) return null;
  if (fotos.length === 1) {
    return (
      <UmaFoto
        foto={fotos[0]}
        autorNome={autorNome}
        onRenovarFoto={onRenovarFoto}
        tom={tom}
      />
    );
  }
  return (
    <Carrossel
      postId={postId}
      fotos={fotos}
      autorNome={autorNome}
      onRenovarFoto={onRenovarFoto}
      tom={tom}
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
    if (lembrada != null) return { ratio: lembrada, medido: true };
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
      const r = w / h;
      setRatio(r);
      lembrarProporcao(foto0.thumbPath, r);
    },
    [foto0.thumbPath]
  );

  // O quadro é o formato permitido mais próximo da foto; antes de medir a
  // foto legada, o quadrado da reserva.
  const formato = formatoMaisProximo(ratio);
  return {
    boxRef,
    formato,
    /** proporção nativa conhecida (nome, memória ou medida), ou null */
    ratioNativo: medido.current ? ratio : null,
    naViewport,
    altura: largura > 0 ? alturaDoQuadro(largura, formato) : 0,
    medirDaMiniatura,
  };
}

const bleed = (
  altura: number,
  formato: Formato,
  tom: string
): React.CSSProperties => ({
  position: "relative",
  // A referência (tela Rede) desenha a foto de ponta a ponta, sem margem e
  // sem raio: o PostCard já não tem padding lateral, então a foto ocupa os
  // 390px. Antes a margem negativa compensava o `p-4` do cartão antigo.
  height: altura || undefined,
  aspectRatio: altura ? undefined : String(formato.ratio),
  overflow: "hidden",
  // O espaço da foto. A referência ALTERNA o tom entre um artigo e o
  // seguinte (`--t-soft` no 1º, `--t-psoft` no 2º), que no app são o
  // `--accent-tint` e o `--violet-tint`. Com um tom só, o 2º post divergia
  // em todos os temas -- e no crimson escuro, onde o acento é muito
  // saturado, essa era a maior diferença da tela inteira.
  background: tom,
});

// ─────────────────────────────── palco ──────────────────────────────────

/**
 * Exportado (ticket #139/#140, redesign iOS): `ProfilePhotoViewer.tsx`
 * reusa este componente pro visualizador dedicado da grade de perfil —
 * mesma lógica real de assinatura/renovação/crossfade/erro-com-retry, só
 * o contêiner ao redor muda (tela cheia vs. sangra o card do feed). Sem
 * isso a grade teria que reimplementar assinatura+renovação+trava-contra-
 * loop do zero, duplicando a parte que já é a mais delicada deste arquivo.
 */
export function PhotoStage({
  foto,
  alt,
  onRenovarFoto,
  onMedirMiniatura,
  /** monta a `<img>` da principal? Falso p/ slide de carrossel ainda não
   * ativado -- sem `<img>` não há requisição de rede pra essa foto. */
  renderPrincipal = true,
  /** No feed: "cortar" preenche o quadro (centrada, só as bordas saem);
   * "inteira" cabe toda, com o fundo desfocado dela na sobra. Sem valor
   * (visualizador do perfil): inteira, sem fundo desfocado, como antes. */
  encaixe,
}: {
  foto: FotoPost;
  alt: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
  onMedirMiniatura?: (w: number, h: number) => void;
  renderPrincipal?: boolean;
  encaixe?: Encaixe;
}) {
  const ajuste: React.CSSProperties =
    encaixe === "cortar"
      ? { objectFit: "cover", objectPosition: "50% 50%" }
      : { objectFit: "contain" };
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

  // Cache hidratado do localStorage vem SEM URL assinada (`thumbUrl`/`url`
  // vazios -- as de 5min não são persistidas, req 5). Aqui a assinatura sob
  // demanda é EXPLÍCITA -- não depende do `onError` de uma <img> sem `src`
  // (que nem dispara de forma confiável). Dispara quando a miniatura falta,
  // e quando a principal falta E o slot já deve montá-la.
  useEffect(() => {
    if (!thumbUrl && !renovandoThumb.current) void renovarThumb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbUrl]);
  useEffect(() => {
    if (
      renderPrincipal &&
      !url &&
      !principalFalhou &&
      !renovandoPrincipal.current
    ) {
      void renovarPrincipal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderPrincipal, url, principalFalhou]);

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
    <div
      style={{ position: "absolute", inset: 0 }}
      data-encaixe={encaixe ?? undefined}
    >
      {/* "inteira": o fundo desfocado da própria foto preenche a sobra
          (nunca uma faixa vazia, nunca a foto esticada). */}
      {encaixe === "inteira" && thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada de Storage
        <img
          src={thumbUrl}
          alt=""
          aria-hidden
          draggable={false}
          data-fundo-desfocado=""
          style={{
            position: "absolute",
            inset: -20,
            width: "calc(100% + 40px)",
            height: "calc(100% + 40px)",
            objectFit: "cover",
            filter: "blur(18px) saturate(1.2)",
            opacity: 0.85,
          }}
        />
      )}
      {/* miniatura -- placeholder, some no crossfade quando a principal
          carrega. Só monta com `src` de verdade: uma <img src=""> (cache
          hidratado, antes da re-assinatura) buscaria a própria página. O
          fundo neutro do `bleed` cobre enquanto a URL não chega. */}
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada de Storage
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
            ...ajuste,
            opacity: principalOk ? 0 : 1,
            transition: "opacity 160ms ease-out",
          }}
        />
      )}

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
            ...ajuste,
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
  tom,
}: {
  foto: FotoPost;
  autorNome: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
  tom: string;
}) {
  const { boxRef, formato, ratioNativo, altura, naViewport, medirDaMiniatura } =
    useAltura(foto);
  return (
    <div
      ref={boxRef}
      style={bleed(altura, formato, tom)}
      data-formato={formato.id}
    >
      <PhotoStage
        foto={foto}
        alt={`Foto da publicação de ${autorNome}`}
        onRenovarFoto={onRenovarFoto}
        onMedirMiniatura={medirDaMiniatura}
        renderPrincipal={naViewport}
        encaixe={
          ratioNativo == null
            ? "inteira"
            : encaixeNoQuadro(ratioNativo, formato.ratio)
        }
      />
    </div>
  );
}

// ─────────────────────────────── carrossel ──────────────────────────────

function Carrossel({
  postId,
  fotos,
  autorNome,
  onRenovarFoto,
  tom,
}: {
  tom: string;
  postId: string;
  fotos: FotoPost[];
  autorNome: string;
  onRenovarFoto: (path: string) => Promise<string | null>;
}) {
  // O quadro do carrossel é o formato da 1ª foto (como o Instagram).
  const { boxRef, formato, ratioNativo, altura, naViewport, medirDaMiniatura } =
    useAltura(fotos[0]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const total = fotos.length;
  // Slide ativo lembrado do último mount (remount do PIN não zera o
  // carrossel). Clampa se o post perdeu fotos desde então.
  const slideInicial = Math.min(slideLembrado(postId), total - 1);
  const [indice, setIndice] = useState(slideInicial);
  // slides cuja principal já pode ser MONTADA -- a 1ª (e as até o slide
  // lembrado) desde o início, as outras só quando a pessoa desliza até
  // elas. Sem `<img>` = nenhum GET.
  const [ativados, setAtivados] = useState<ReadonlySet<number>>(() => {
    const s = new Set<number>();
    for (let i = 0; i <= slideInicial; i++) s.add(i);
    return s;
  });

  // Reposiciona o scroller no slide lembrado antes do 1º paint.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || slideInicial === 0) return;
    el.scrollLeft = slideInicial * (el.clientWidth || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          Math.min(total - 1, Math.round(el.scrollLeft / w))
        );
        setIndice(i);
        lembrarSlide(postId, i);
        setAtivados((prev) => (prev.has(i) ? prev : new Set([...prev, i])));
      });
    };
    el.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      el.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(raf);
    };
  }, [total, postId]);

  /** Vai para o slide `alvo` (limitado às pontas), com o encaixe do snap. */
  const irPara = useCallback(
    (alvo: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const i = Math.max(0, Math.min(total - 1, alvo));
      el.scrollTo({
        left: i * el.clientWidth,
        behavior: resolveScrollBehavior(prefereMovimentoReduzido()),
      });
    },
    [total]
  );

  return (
    <>
      <div
        ref={boxRef}
        style={bleed(altura, formato, tom)}
        data-formato={formato.id}
        data-carrossel=""
      >
        {/* scroller nativo: dedo arrasta, encaixe por scroll-snap, física do
            iOS. touch-action no default → o navegador arbitra o eixo do
            gesto (rolagem vertical da lista nunca trava). Com foco, as
            setas do teclado trocam a foto.
            overscroll-behavior-x: contain é só uma dica -- NÃO garante bloqueio
            do gesto "Voltar" do iOS (a validar no aparelho). */}
        <div
          ref={scrollerRef}
          className="feed-foto-scroller"
          tabIndex={0}
          role="group"
          aria-roledescription="carrossel"
          aria-label={`${total} fotos da publicação de ${autorNome}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              irPara(indice + 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              irPara(indice - 1);
            }
          }}
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
                overflow: "hidden",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
              }}
            >
              <PhotoStage
                foto={foto}
                alt={`Foto ${i + 1} de ${total} da publicação de ${autorNome}`}
                onRenovarFoto={onRenovarFoto}
                onMedirMiniatura={i === 0 ? medirDaMiniatura : undefined}
                renderPrincipal={naViewport && ativados.has(i)}
                encaixe={
                  i === 0
                    ? ratioNativo == null
                      ? "inteira"
                      : encaixeNoQuadro(ratioNativo, formato.ratio)
                    : encaixeDoSlide(ratioDe(foto), formato)
                }
              />
            </div>
          ))}
        </div>

        {/* contador 1/N no canto, como o Instagram */}
        <span
          aria-live="polite"
          data-contador=""
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 3,
            background: "rgba(0,0,0,.55)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            padding: "4px 9px",
            borderRadius: 999,
            letterSpacing: ".02em",
            pointerEvents: "none",
          }}
        >
          {indice + 1}/{total}
        </span>

        {/* setas -- em qualquer aparelho (o dedo também desliza), alvo
            44×44 com o círculo de 30 da proposta; somem nas pontas */}
        {indice > 0 && (
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => irPara(indice - 1)}
            style={{ ...setaBase, left: 4 }}
          >
            <span style={setaCirculo}>
              <ChevronLeft size={16} strokeWidth={3} />
            </span>
          </button>
        )}
        {indice < total - 1 && (
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => irPara(indice + 1)}
            style={{ ...setaBase, right: 4 }}
          >
            <span style={setaCirculo}>
              <ChevronRight size={16} strokeWidth={3} />
            </span>
          </button>
        )}
      </div>

      {/* bolinhas -- ABAIXO da foto; a ativa no acento */}
      <div
        aria-hidden
        data-bolinhas=""
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 5,
          marginTop: 10,
        }}
      >
        {fotos.map((f, i) => (
          <span
            key={f.ordem}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: i === indice ? "var(--t-acc)" : "var(--t-ring)",
              transform: i === indice ? "scale(1.15)" : undefined,
              transition: "all 200ms",
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
  zIndex: 3,
  width: 44,
  height: 44,
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
};

const setaCirculo: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "rgba(255,255,255,.88)",
  color: "#111",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,.25)",
};
