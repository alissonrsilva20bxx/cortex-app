"use client";

import { useEffect, useRef, useState } from "react";
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
    const delay = alreadySeenThisTab ? 0 : reducedMotion ? 450 : 2100;
    const timer = window.setTimeout(() => setLeaving(true), delay);
    return () => window.clearTimeout(timer);
  }, [alreadySeenThisTab]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onDoneRef.current(), 280);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  function skip() {
    setLeaving(true);
  }

  return (
    <div
      className={`${styles.motionScreen} ${leaving ? styles.motionLeaving : ""}`}
      aria-label="Abertura do JobApp"
    >
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.motionInner}>
        <AtlasMotion />
      </div>
      <button className={styles.skip} type="button" onClick={skip}>
        Pular
      </button>
    </div>
  );
}

function EntryMark() {
  return (
    <div className={styles.mark}>
      <b>JobApp</b>
      <i>feito para a sua realidade</i>
    </div>
  );
}

function AtlasMotion() {
  return (
    <>
      <svg className={styles.route} viewBox="0 0 390 600" aria-hidden="true">
        <path d="M45 420 C105 320 78 206 168 174 S286 180 337 83" />
        <circle cx="62" cy="394" r="3" />
        <circle cx="173" cy="173" r="3" />
        <circle cx="327" cy="101" r="3" />
      </svg>
      <span className={`${styles.city} ${styles.paris}`}>
        PARIS<small>48.8566° N</small>
      </span>
      <span className={`${styles.city} ${styles.london}`}>
        LONDON<small>51.5072° N</small>
      </span>
      <span className={`${styles.city} ${styles.rio}`}>
        RIO<small>22.9068° S</small>
      </span>
      <span className={styles.plane}>✦</span>
      <span className={styles.atlasLine} />
      <EntryMark />
    </>
  );
}
