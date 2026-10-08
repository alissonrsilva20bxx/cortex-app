"use client";

import { useEffect, useRef, useState } from "react";
import { verifyPin } from "@/lib/pin";
import styles from "./PinScreen.module.css";

/**
 * Tela de bloqueio "Cartão Cofre" (proposta 2, sem Face ID), copiada de
 * docs/jornada/referencias/tela-bloqueio-cartao-cofre.html: cartão do topo
 * com o Voltar sempre no mesmo canto, 4 casas que ficam vermelhas no erro e
 * verdes no acerto, teclado em azulejos e um "Esqueci o PIN" discreto onde
 * ficava o Face ID. Cores só pelos tokens do app (--t-*): funciona nos 8
 * temas, claro e escuro.
 *
 * A segurança é a de antes, sem mudança: o mesmo `verifyPin` (SHA-256 de
 * lib/pin.ts), 4 dígitos, erro limpa em 700ms e o acerto libera em 200ms.
 * Não há contagem de erros nem bloqueio por tempo (não existem em
 * lib/pin.ts, e esta tela não inventa).
 */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/** Ícones do desenho aprovado, traço a traço (22px; cor e ponta no CSS). */
const ICONE = {
  voltar: (
    <svg viewBox="0 0 24 24" strokeWidth="2.4" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  apagar: (
    <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round">
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
      <path d="M18 9l-6 6M12 9l6 6" />
    </svg>
  ),
  escudo: (
    <svg viewBox="0 0 24 24" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  certo: (
    <svg viewBox="0 0 24 24" strokeWidth="3" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  errado: (
    <svg viewBox="0 0 24 24" strokeWidth="2.6">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
};

interface Props {
  pinHash: string;
  onUnlock: () => void;
  context?: "app" | "vault";
  /** Voltar sem digitar o PIN. Só o Cofre passa: a trava do app inteiro
   * não tem pra onde voltar, então ali o lugar do Voltar fica reservado e
   * vazio (nada muda de posição entre as duas telas). */
  onCancel?: () => void;
  /** "Esqueci o PIN" no Cofre: o app já está aberto, então o caminho que
   * existe é Ajustes › Segurança e PIN (desligar e criar outro). */
  onAbrirAjustes?: () => void;
  /** "Esqueci o PIN" na trava do app: o único caminho que existe é sair da
   * conta. Não há recuperação de PIN (ADR 0003); a tela diz isso. */
  onSair?: () => void;
}

export function PinScreen({
  pinHash,
  onUnlock: unlock,
  context = "app",
  onCancel,
  onAbrirAjustes,
  onSair,
}: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const vault = context === "vault";

  useEffect(() => {
    if (digits.length !== 4) return;
    let cancelled = false;
    let unlockTimer: number | undefined;
    const onUnlock = () => {
      if (cancelled) return;
      setUnlocked(true);
      unlockTimer = window.setTimeout(() => {
        if (!cancelled) unlock();
      }, 200);
    };
    setVerifying(true);

    verifyPin(digits.join(""), pinHash).then((ok) => {
      if (ok) {
        onUnlock();
        return;
      }
      if (cancelled) return;

      setShake(true);
      setError(true);
      window.setTimeout(() => {
        if (cancelled) return;
        setShake(false);
        setError(false);
        setDigits([]);
        setVerifying(false);
      }, 700);
    });

    return () => {
      cancelled = true;
      if (unlockTimer) window.clearTimeout(unlockTimer);
    };
  }, [digits, pinHash, unlock]);

  function press(key: string) {
    if (verifying) return;
    if (key === "del") {
      setDigits((current) => current.slice(0, -1));
    } else if (key) {
      setDigits((current) =>
        current.length < 4 ? [...current, key] : current
      );
    }
  }

  // Modal de verdade: o que fica atrás da trava (no Cofre ela é um portal
  // por cima do app inteiro) não recebe Tab nem toque, e some da tela. A
  // trava é opaca, então nada visível muda; e a barra de abas (com
  // backdrop-filter) deixa de forçar a trava numa camada própria, que
  // rasterizava o texto diferente do desenho aprovado.
  const raiz = useRef<HTMLElement>(null);
  useEffect(() => {
    let topo: Element | null = raiz.current;
    while (topo && topo.parentElement !== document.body)
      topo = topo.parentElement;
    if (!topo) return;
    const atras = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el !== topo && el instanceof HTMLElement
    );
    const antes = atras.map((el) => [el.inert, el.style.visibility] as const);
    for (const el of atras) {
      el.inert = true;
      el.style.visibility = "hidden";
    }
    return () =>
      atras.forEach((el, i) => {
        el.inert = antes[i][0];
        el.style.visibility = antes[i][1];
      });
  }, []);

  // Teclado físico (computador, teclado bluetooth): 0–9 e Backspace.
  useEffect(() => {
    if (esqueci) return;
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const estado = unlocked ? "ok" : error ? "err" : undefined;
  const mensagem = error
    ? "Esse PIN não confere. Tente de novo."
    : unlocked
      ? "Tudo certo, abrindo…"
      : verifying
        ? "Verificando…"
        : vault
          ? "Digite seu PIN para ver seus arquivos protegidos."
          : "Confirme que é você para entrar no JobApp.";

  return (
    <main
      ref={raiz}
      className={`${styles.page} fixed inset-0 z-[100]`}
      data-vault={vault ? "true" : "false"}
      data-unlocked={unlocked ? "true" : "false"}
      data-estado={estado}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-screen-title"
      tabIndex={-1}
    >
      <div className={styles.hero}>
        {/* O Voltar mora SEMPRE aqui; na trava do app o espaço fica vazio. */}
        <div className={styles.backslot}>
          {onCancel && (
            <button
              type="button"
              className={styles.back}
              onClick={onCancel}
              aria-label="Voltar sem abrir o Cofre"
              data-pin-voltar
            >
              <span className={styles.backCirculo}>{ICONE.voltar}</span>
              Voltar
            </button>
          )}
        </div>
        <div className={styles.row}>
          <div className={styles.shield} aria-hidden="true">
            {unlocked ? ICONE.certo : error ? ICONE.errado : ICONE.escudo}
          </div>
          <div>
            <div className={styles.eyebrow}>{vault ? "Cofre" : "JobApp"}</div>
            <h1 id="pin-screen-title" className={styles.title}>
              {unlocked
                ? "Acesso liberado"
                : vault
                  ? "Abra seu Cofre"
                  : "Digite seu PIN"}
            </h1>
          </div>
        </div>
      </div>

      <div
        className={`${styles.boxes} ${shake ? styles.shake : ""}`}
        aria-label={`${digits.length} de 4 dígitos preenchidos`}
        data-pin-casas
      >
        {[0, 1, 2, 3].map((index) => (
          <i
            key={index}
            className={`${digits.length > index || unlocked ? styles.filled : ""} ${digits.length === index && !error && !unlocked && !verifying ? styles.current : ""}`}
          />
        ))}
      </div>

      <p className={styles.msg} aria-live="polite" data-pin-mensagem>
        {mensagem}
      </p>

      <div className={styles.sheet}>
        {esqueci ? (
          <div
            key="ajuda"
            className={styles.ajuda}
            role="region"
            aria-label="Esqueci o PIN"
            data-pin-ajuda
          >
            <strong>Esqueci o PIN</strong>
            <p>
              {vault
                ? "O JobApp não guarda o seu PIN, então não dá para mostrá-lo. Em Ajustes › Segurança e PIN você pode desligar o PIN e criar um novo."
                : "O JobApp não guarda o seu PIN, então não dá para mostrá-lo nem recuperá-lo por aqui. Você pode sair da conta, mas ao entrar de novo com a sua senha o mesmo PIN continua sendo pedido."}
            </p>
            {vault
              ? onAbrirAjustes && (
                  <button
                    type="button"
                    className={styles.ajudaAcao}
                    onClick={onAbrirAjustes}
                    data-pin-ajuda-acao="ajustes"
                  >
                    Abrir Ajustes
                  </button>
                )
              : onSair && (
                  <button
                    type="button"
                    className={styles.ajudaAcao}
                    onClick={onSair}
                    data-pin-ajuda-acao="sair"
                  >
                    Sair da conta
                  </button>
                )}
            <button
              type="button"
              className={styles.forgot}
              onClick={() => setEsqueci(false)}
              data-pin-ajuda-voltar
            >
              Voltar ao teclado
            </button>
          </div>
        ) : (
          // Chaves distintas nos dois ramos: sem elas o React reaproveitava
          // um botão do teclado dentro do painel (um "9" sobrando).
          <div key="teclado">
            <div className={styles.pad} aria-label="Teclado do PIN">
              {KEYS.map((key, index) => {
                if (!key) return <span key={index} aria-hidden="true" />;
                const isDelete = key === "del";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => press(key)}
                    disabled={verifying}
                    className={isDelete ? styles.del : undefined}
                    aria-label={
                      isDelete ? "Apagar último dígito" : `Dígito ${key}`
                    }
                    data-key={key}
                  >
                    {isDelete ? ICONE.apagar : key}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={styles.forgot}
              onClick={() => setEsqueci(true)}
              data-pin-esqueci
            >
              Esqueci o PIN
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
