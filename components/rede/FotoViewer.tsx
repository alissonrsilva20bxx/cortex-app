"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { FotoPost } from "@/lib/rede/feed";

interface Props {
  fotos: FotoPost[];
  indiceInicial: number;
  /** Assina em LOTE as URLs principais das fotos deste post (máx. 2) --
   * uma chamada só. Devolve path -> URL. */
  assinarPrincipais: (paths: string[]) => Promise<Map<string, string>>;
  onFechar: () => void;
}

/**
 * Visualizador de foto em tela cheia, dentro do app -- sem nova aba, sem
 * `window.location`. Portal pro body, acima de tudo.
 *
 * Abertura instantânea: mostra JÁ a miniatura da foto tocada (que o
 * navegador acabou de exibir no feed, então vem do cache), e em paralelo
 * assina EM LOTE as principais deste post e pré-carrega as duas (`new
 * Image()`). Trocar de foto usa a principal já pré-carregada -- sem novo
 * atraso de assinatura nem de download. Nunca baixa principal de outro
 * post.
 *
 * - fundo opaco, principal centralizada e inteira (object-contain)
 * - fecha por X, Esc e Voltar do navegador/celular (pushState + popstate)
 * - fechar volta ao mesmo ponto de rolagem do feed (o feed nunca desmonta)
 * - post com 2 fotos: setas / swipe / ← → e contador "1/2"
 * - rolagem do fundo travada; foco preso no dialog
 * - miniatura de placeholder (blur leve) com crossfade curto pra principal
 * - falha da principal: mensagem discreta + "tentar de novo", miniatura fica
 */
export function FotoViewer({
  fotos,
  indiceInicial,
  assinarPrincipais,
  onFechar,
}: Props) {
  const [indice, setIndice] = useState(indiceInicial);
  // path -> URL assinada da principal (lote, cacheada durante a sessão do modal)
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  // índices cuja <img> principal já terminou de carregar (crossfade concluído)
  const [carregadas, setCarregadas] = useState<Set<number>>(new Set());
  // índices cuja principal falhou ao carregar
  const [comErro, setComErro] = useState<Set<number>>(new Set());
  // a assinatura em lote em si falhou (rede caiu / RLS mudou)
  const [assinaturaFalhou, setAssinaturaFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const fecharBtnRef = useRef<HTMLButtonElement>(null);
  const foraDeCena = useRef(false);
  const touchX = useRef<number | null>(null);

  const total = fotos.length;
  const fotoAtual = fotos[indice];
  const paths = useMemo(() => fotos.map((f) => f.path), [fotos]);

  // --- assina EM LOTE as principais deste post e pré-carrega as duas ---
  useEffect(() => {
    let vivo = true;
    setAssinaturaFalhou(false);
    assinarPrincipais(paths)
      .then((mapa) => {
        if (!vivo) return;
        if (mapa.size === 0) {
          setAssinaturaFalhou(true);
          return;
        }
        setUrls(mapa);
        // prefetch: warm no cache do navegador das principais (máx. 2)
        for (const url of mapa.values()) {
          const img = new Image();
          img.decoding = "async";
          img.src = url;
        }
      })
      .catch(() => {
        if (vivo) setAssinaturaFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [paths, assinarPrincipais, tentativa]);

  const urlAtual = urls.get(fotoAtual?.path ?? "");
  const principalPronta = carregadas.has(indice);
  const erroAtual = assinaturaFalhou || comErro.has(indice);

  const tentarDeNovo = useCallback(() => {
    setComErro((s) => {
      const n = new Set(s);
      n.delete(indice);
      return n;
    });
    setCarregadas((s) => {
      const n = new Set(s);
      n.delete(indice);
      return n;
    });
    setUrls(new Map());
    setTentativa((t) => t + 1); // re-assina o lote
  }, [indice]);

  // ---- fechar: X / Esc / Voltar, tudo por popstate ----
  const fecharAgora = useRef(onFechar);
  useEffect(() => {
    fecharAgora.current = onFechar;
  }, [onFechar]);

  useEffect(() => {
    window.history.pushState({ fotoViewer: true }, "");
    const onPop = () => {
      foraDeCena.current = true;
      fecharAgora.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!foraDeCena.current) window.history.back();
    };
  }, []);

  const solicitarFechar = useCallback(() => {
    window.history.back();
  }, []);

  // ---- rolagem do fundo travada + foco ----
  useEffect(() => {
    const scrollBarGap =
      window.innerWidth - document.documentElement.clientWidth;
    const overflowAntes = document.body.style.overflow;
    const padAntes = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollBarGap > 0)
      document.body.style.paddingRight = `${scrollBarGap}px`;
    const focoAntes = document.activeElement as HTMLElement | null;
    fecharBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = overflowAntes;
      document.body.style.paddingRight = padAntes;
      focoAntes?.focus?.();
    };
  }, []);

  // ---- teclado ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        solicitarFechar();
      } else if (e.key === "ArrowLeft") {
        setIndice((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setIndice((i) => Math.min(total - 1, i + 1));
      } else if (e.key === "Tab") {
        const alvos =
          overlayRef.current?.querySelectorAll<HTMLElement>("button");
        if (!alvos || alvos.length === 0) return;
        const lista = Array.from(alvos);
        const idx = lista.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        const prox = e.shiftKey
          ? lista[(idx - 1 + lista.length) % lista.length]
          : lista[(idx + 1) % lista.length];
        prox?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [total, solicitarFechar]);

  const overlay = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${indice + 1} de ${total}`}
      className="fixed inset-0 z-[80] flex flex-col select-none"
      style={{
        background: "#0b0b0d",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        animation: "fotoViewerFade 120ms ease-out",
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
        if (Math.abs(dx) > 50) {
          setIndice((i) =>
            Math.max(0, Math.min(total - 1, i + (dx < 0 ? 1 : -1)))
          );
        }
        touchX.current = null;
      }}
    >
      {/* topo: contador + fechar */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        <span
          className="text-sm tabular-nums"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          {total > 1 ? `${indice + 1}/${total}` : ""}
        </span>
        <button
          ref={fecharBtnRef}
          onClick={solicitarFechar}
          aria-label="Fechar"
          className="flex items-center justify-center rounded-full active:opacity-60 transition-opacity"
          style={{ width: 40, height: 40, color: "white" }}
        >
          <X size={24} />
        </button>
      </div>

      {/* palco */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) solicitarFechar();
        }}
      >
        {/* miniatura de placeholder -- some quando a principal carrega */}
        {fotoAtual?.thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoAtual.thumbUrl}
            alt=""
            aria-hidden
            className="absolute max-w-full max-h-full object-contain"
            style={{
              filter: "blur(2px)",
              transform: "scale(1.02)",
              opacity: principalPronta && !erroAtual ? 0 : 0.85,
              transition: "opacity 160ms ease-out",
            }}
          />
        )}

        {/* imagem principal (usa a URL do lote; cache do navegador já quente) */}
        {urlAtual && !assinaturaFalhou && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`p-${indice}-${tentativa}`}
            src={urlAtual}
            alt={`Foto ${indice + 1} de ${total}`}
            decoding="async"
            className="relative max-w-full max-h-full object-contain"
            style={{
              opacity: principalPronta && !comErro.has(indice) ? 1 : 0,
              transition: "opacity 160ms ease-out",
            }}
            onLoad={() => setCarregadas((s) => new Set(s).add(indice))}
            onError={() => setComErro((s) => new Set(s).add(indice))}
          />
        )}

        {/* estado de falha: discreto, miniatura continua atrás */}
        {erroAtual && (
          <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2 px-6">
            <p
              className="text-xs px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(0,0,0,0.55)",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Não foi possível carregar a imagem em tamanho real.
            </p>
            <button
              onClick={tentarDeNovo}
              className="text-xs px-4 py-2 rounded-full active:opacity-70"
              style={{ background: "rgba(255,255,255,0.16)", color: "white" }}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {/* setas laterais (post com 2 fotos) */}
        {total > 1 && indice > 0 && (
          <button
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
            aria-label="Foto anterior"
            className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full active:opacity-60"
            style={{
              width: 44,
              height: 44,
              background: "rgba(0,0,0,0.4)",
              color: "white",
            }}
          >
            <ChevronLeft size={26} />
          </button>
        )}
        {total > 1 && indice < total - 1 && (
          <button
            onClick={() => setIndice((i) => Math.min(total - 1, i + 1))}
            aria-label="Próxima foto"
            className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full active:opacity-60"
            style={{
              width: 44,
              height: 44,
              background: "rgba(0,0,0,0.4)",
              color: "white",
            }}
          >
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      {/* pontinhos (post com 2 fotos) */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 h-8 shrink-0">
          {fotos.map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === indice ? 7 : 5,
                height: i === indice ? 7 : 5,
                background: i === indice ? "white" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes fotoViewerFade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
