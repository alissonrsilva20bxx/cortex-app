"use client";

import { useEffect, useRef, useState } from "react";
import {
  ABERTURA_ESTATICA_MS,
  INICIO_DA_SAIDA_MS,
  PARADAS,
  PONTOS_DA_ROTA,
  type IconeDaParada,
} from "@/lib/entry/rotaDasMetas";
import styles from "./OpeningMotion.module.css";

interface Props {
  /** Chamado quando a abertura termina (ou é pulada) e a transição de saída conclui. */
  onDone: () => void;
}

// Sempre toca por inteiro, mesmo pra quem já está logada — é a abertura do
// app, não um tour de primeira visita. Home e login chamam com o mesmo
// componente pra manter idêntico o "abriu o JobApp" em qualquer entrada.
// Exportada pra Home (app/page.tsx) poder pular a própria montagem quando o
// login acabou de tocar essa animação nesta mesma aba — ver comentário lá.
export const SEEN_THIS_TAB_KEY = "jobapp-entry-motion-seen";

/** Duração da transição de saída (ms): some e cresce 2%, como no desenho. */
const SAIDA_MS = 280;

/**
 * Quanto da cena já passou (ms), pelo relógio da própria animação do palco:
 * a cena começa na 1ª pintura (HTML do servidor), antes da hidratação, e a
 * saída tem que cair aos 4,0 s dela, não 4,0 s depois da hidratação.
 * `performance.now() - startTime` (a linha do tempo do documento tem a
 * mesma origem do `performance.now()`), não `currentTime`: com o movimento
 * reduzido nada muda na tela, o navegador para de pintar quadros e o
 * `currentTime` fica parado no começo.
 */
function tempoDaCena(palco: HTMLElement | null): number {
  const inicio = palco?.getAnimations?.()[0]?.startTime;
  if (typeof inicio !== "number") return 0;
  const t = performance.now() - inicio;
  return t > 0 ? t : 0;
}

export function OpeningMotion({ onDone }: Props) {
  // Lida no render (lazy init), nunca no efeito — um efeito que lê E escreve
  // a mesma chave se auto-engana no Strict Mode do dev, que roda o efeito
  // duas vezes: a 2ª leitura veria a escrita da 1ª e acharia que "já viu"
  // numa sessão que acabou de começar. Ler uma vez por instância aqui evita
  // essa race (mesmo padrão de ThemeProvider.tsx para o problema análogo).
  const [alreadySeenThisTab] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(SEEN_THIS_TAB_KEY) === "1"
  );
  const [leaving, setLeaving] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const palcoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cobre só o caso /login → OAuth → redirect pra home, onde as duas
    // telas montam a mesma OpeningMotion em sequência de segundos — sem
    // isso a pessoa veria a abertura completa duas vezes seguidas. Não é
    // "pular pra quem já viu" (decisão já rejeitada): sessionStorage some
    // ao fechar a aba, então toda sessão nova (aba nova, dia seguinte)
    // ainda assiste a abertura inteira; só não repete dentro da mesma aba.
    sessionStorage.setItem(SEEN_THIS_TAB_KEY, "1");

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Rota das metas: 4,0 s no total (a saída começa aos 3,72 s e leva
    // 280 ms). Movimento reduzido: o quadro final parado, curto. Os dois
    // contados da 1ª pintura (o relógio do palco), não da hidratação.
    const decorrido = tempoDaCena(palcoRef.current);
    const delay = alreadySeenThisTab
      ? 0
      : reducedMotion
        ? Math.max(0, ABERTURA_ESTATICA_MS - decorrido)
        : Math.max(0, INICIO_DA_SAIDA_MS - decorrido);
    const timer = window.setTimeout(() => setLeaving(true), delay);
    return () => window.clearTimeout(timer);
  }, [alreadySeenThisTab]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onDoneRef.current(), SAIDA_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // Pular nunca trava a entrada: o botão, um toque em qualquer lugar da
  // tela ou Esc/Enter/Espaço no teclado.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ")
        setLeaving(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function skip() {
    setLeaving(true);
  }

  return (
    <div
      className={`${styles.motionScreen} ${leaving ? styles.motionLeaving : ""}`}
      aria-label="Abertura do JobApp"
      onClick={skip}
      data-abertura="rota-das-metas"
    >
      <div ref={palcoRef} className={styles.palco} aria-hidden="true">
        <RotaDasMetas />
      </div>
      <button className={styles.skip} type="button" onClick={skip}>
        Pular
      </button>
    </div>
  );
}

/** Ícones das paradas: os mesmos traços das abas do app no desenho. */
function IconeParada({ icone }: { icone: IconeDaParada }) {
  const traco = icone === "jornada" ? 2.2 : 2;
  return (
    <svg className={styles.ico} viewBox="0 0 24 24" strokeWidth={traco}>
      {icone === "inicio" && (
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
      )}
      {icone === "agenda" && (
        <>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </>
      )}
      {icone === "financeiro" && (
        <>
          <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15V7" />
          <path d="M16 14h.01" />
        </>
      )}
      {icone === "cofre" && (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </>
      )}
      {icone === "jornada" && <path d="M22 12h-4l-3 9L9 3l-3 9H2" />}
    </svg>
  );
}

/**
 * "Rota das metas": a linha do atlas sai do Início e se desenha passando
 * por Agenda, Financeiro, Cofre e Jornada até o pin da viagem (PARIS), com
 * LONDON e RIO no mapa. Coordenadas no quadro do desenho (390×844); a
 * escala para a tela é o `--u` do CSS.
 */
function RotaDasMetas() {
  return (
    <>
      <span className={`${styles.city} ${styles.london}`}>
        LONDON<small>51.5072° N</small>
      </span>
      <span className={`${styles.city} ${styles.rio}`}>
        RIO<small>22.9068° S</small>
      </span>

      <svg className={styles.rota} viewBox="0 0 390 844" data-rota>
        {PONTOS_DA_ROTA.map(([x, y, r, atraso], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            style={{ animationDelay: `${atraso}s` }}
          />
        ))}
      </svg>

      {PARADAS.map((p) => (
        <div
          key={p.nome}
          className={`${styles.stop} ${p.icone === "inicio" ? styles.home : ""}`}
          data-parada={p.icone}
          style={{
            left: `calc(var(--u) * ${p.x - 23})`,
            top: `calc(var(--u) * ${p.y - 23})`,
            animationDelay: `${p.atraso}s`,
          }}
        >
          <span className={styles.bubble}>
            <IconeParada icone={p.icone} />
          </span>
          <span className={styles.blabel}>{p.nome}</span>
        </div>
      ))}

      <svg className={styles.traveler} viewBox="0 0 24 24" data-viajante>
        <path d="M12 3l1.9 5.6a2 2 0 0 0 1.3 1.3L21 12l-5.8 2.1a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.6a2 2 0 0 0-1.3-1.3L3 12l5.8-2.1a2 2 0 0 0 1.3-1.3z" />
      </svg>
      <span className={styles.destring} />
      <svg className={styles.dest} viewBox="0 0 24 30" data-destino>
        <path d="M12 29s10-9.5 10-17A10 10 0 0 0 2 12c0 7.5 10 17 10 17z" />
        <circle cx="12" cy="12" r="3.6" />
      </svg>
      <div className={styles.destlab}>
        <b>PARIS</b>
        <small>48.8566° N · a viagem</small>
      </div>
      <div className={styles.mark}>
        <b>JobApp</b>
        <i>feito para a sua realidade</i>
      </div>
    </>
  );
}
