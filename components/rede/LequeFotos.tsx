"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FotoPost } from "@/lib/rede/feed";
import { PhotoStage } from "./FeedFotos";
import { alturaDoLeque } from "@/lib/rede/leque";
import s from "./doca.module.css";

/**
 * O par de fotos do post em leque (modelo Doca, protótipo aprovado
 * .lavish/rede-doca-final.html): o post tem no máximo 2 fotos (travado no
 * banco, migration 0028), então o par é o formato nativo. Fechado, as duas
 * aparecem em leque, uma sobre a outra; um toque abre as duas lado a lado,
 * outro toque junta. Dois toques seguidos curtem (como no Instagram, o
 * duplo toque só curte, nunca descurte). Sem rótulos e sem revelar uma
 * foto sobre a outra: só a abertura do par.
 *
 * A mídia é toda do `PhotoStage` (FeedFotos.tsx): URL assinada de 5 min,
 * miniatura na hora, principal com crossfade e renovação com trava. A
 * principal só é montada quando o post chega perto da tela.
 */

/** Tempo entre dois toques para contar como duplo, em ms. */
const DUPLO_MS = 280;

interface Props {
  fotos: FotoPost[];
  autorNome: string;
  aberto: boolean;
  onAlternar: () => void;
  onCurtirDuplo: () => void;
  onRenovarFoto: (path: string) => Promise<string | null>;
}

export function LequeFotos({
  fotos,
  autorNome,
  aberto,
  onAlternar,
  onCurtirDuplo,
  onRenovarFoto,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [perto, setPerto] = useState(false);
  const [coracao, setCoracao] = useState(0);
  const ultimoToque = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLargura(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    if (typeof IntersectionObserver === "undefined") {
      setPerto(true);
      return () => ro.disconnect();
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPerto(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function tocar() {
    const agora = Date.now();
    if (agora - ultimoToque.current < DUPLO_MS) {
      window.clearTimeout(timer.current);
      ultimoToque.current = 0;
      setCoracao((c) => c + 1);
      onCurtirDuplo();
      return;
    }
    ultimoToque.current = agora;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      ultimoToque.current = 0;
      onAlternar();
    }, DUPLO_MS);
  }

  const par = fotos.slice(0, 2);
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-expanded={aberto}
      aria-label={`As duas fotos de ${autorNome}. Toque para ${aberto ? "juntar" : "abrir"}; dois toques curtem`}
      data-leque={aberto ? "aberto" : "fechado"}
      className={`${s.leque} ${aberto ? s.aberto : ""}`}
      style={{ height: alturaDoLeque(largura, aberto) }}
      onClick={tocar}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAlternar();
        }
      }}
    >
      {par.map((foto, i) => (
        <div key={foto.ordem} className={s.foto}>
          <PhotoStage
            foto={foto}
            alt={`Foto ${i + 1} de 2 da publicação de ${autorNome}`}
            onRenovarFoto={onRenovarFoto}
            renderPrincipal={perto}
            encaixe="cortar"
          />
        </div>
      ))}
      <span className={s.dica} aria-hidden>
        {aberto ? "toque para juntar" : "toque para abrir"}
      </span>
      {coracao > 0 && (
        <span
          key={coracao}
          className={s.coracao}
          aria-hidden
          onAnimationEnd={() => setCoracao(0)}
        >
          <svg
            viewBox="0 0 24 24"
            width="100%"
            height="100%"
            fill="currentColor"
          >
            <path d="M12 20.2s-7.6-4.5-7.6-10.2A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.6 2.5c0 5.7-7.6 10.2-7.6 10.2z" />
          </svg>
        </span>
      )}
    </div>
  );
}
