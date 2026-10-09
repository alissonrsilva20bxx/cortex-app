"use client";

import { useEffect, useRef, useState } from "react";
import { hashPin, verifyPin } from "@/lib/pin";
import {
  formatarEspera,
  gravarTentativas,
  lerTentativas,
  registrarErro,
  restanteDaEspera,
  SEM_TENTATIVAS,
  zerarTentativas,
  type EstadoTentativas,
} from "@/lib/pinTentativas";
import { limparReauthDaUrl, reauthAtual } from "@/lib/reauth";
import type { ReauthAdapter } from "@/lib/reauthRegras";
import { ReauthModal } from "./ReauthModal";
import styles from "./PinScreen.module.css";

/**
 * Tela de bloqueio "Cartão Cofre" (proposta 2, sem Face ID), copiada de
 * docs/jornada/referencias/tela-bloqueio-cartao-cofre.html: cartão do topo
 * com o Voltar sempre no mesmo canto, 4 casas que ficam vermelhas no erro e
 * verdes no acerto, teclado em azulejos e um "Esqueci o PIN" discreto onde
 * ficava o Face ID. Cores só pelos tokens do app (--t-*): funciona nos 8
 * temas, claro e escuro.
 *
 * Segurança:
 *  - o mesmo `verifyPin` (SHA-256 de lib/pin.ts), 4 dígitos; erro limpa em
 *    700ms e o acerto libera em 200ms;
 *  - limite de tentativas (lib/pinTentativas.ts): o 5º erro trava o teclado
 *    por 1 minuto, e cada erro depois dobra a espera (2, 4, 8… até 1 hora);
 *    o contador é da conta, neste aparelho, e vale para a trava do app e a
 *    do Cofre;
 *  - "Esqueci o PIN" pede a senha da conta ou o Google (ReauthModal) e só
 *    então deixa criar um PIN novo, digitado duas vezes. O PIN antigo nunca
 *    aparece (o app só guarda o hash).
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
  /** Dona do PIN: chave do contador de tentativas e da gravação do PIN novo. */
  usuarioId: string;
  /** Voltar sem digitar o PIN. Só o Cofre passa: a trava do app inteiro
   * não tem pra onde voltar, então ali o lugar do Voltar fica reservado e
   * vazio (nada muda de posição entre as duas telas). */
  onCancel?: () => void;
  /** PIN novo salvo depois do "Esqueci o PIN": quem chama troca o hash; a
   * tela libera pelo mesmo `onUnlock` de sempre. */
  onPinRedefinido?: (hash: string) => void;
  /** Conta sem senha nem Google: a confirmação oferece sair da conta. */
  onSair?: () => void;
  /** Laboratório e testes trocam a confirmação da conta. */
  reauth?: ReauthAdapter;
}

/** teclado: digitar o PIN · reauth: confirmar a conta · novo/confirmar: PIN novo. */
type Etapa = "teclado" | "reauth" | "novo" | "confirmar";

export function PinScreen({
  pinHash,
  onUnlock: unlock,
  context = "app",
  usuarioId,
  onCancel,
  onPinRedefinido,
  onSair,
  reauth: reauthProp,
}: Props) {
  const reauth = reauthProp ?? reauthAtual();
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("teclado");
  const [primeiro, setPrimeiro] = useState<string | null>(null);
  const [falhaAoGravar, setFalhaAoGravar] = useState(false);
  const vault = context === "vault";

  // Limite de tentativas: o contador mora no aparelho (por conta), então
  // fechar e abrir a tela não zera a espera.
  const [tentativas, setTentativas] = useState<EstadoTentativas>(() =>
    lerTentativas(usuarioId)
  );
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    setTentativas(lerTentativas(usuarioId));
    setAgora(Date.now());
  }, [usuarioId]);
  useEffect(() => {
    if (!tentativas.esperaAte) return;
    setAgora(Date.now());
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [tentativas.esperaAte]);
  const espera = etapa === "teclado" ? restanteDaEspera(tentativas, agora) : 0;
  const emEspera = espera > 0;

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

    // PIN novo, 1ª vez: guarda e pede de novo.
    if (etapa === "novo") {
      setPrimeiro(digits.join(""));
      setDigits([]);
      setEtapa("confirmar");
      return;
    }

    // PIN novo, 2ª vez: tem que ser igual; aí grava o hash na conta.
    if (etapa === "confirmar") {
      const novo = digits.join("");
      if (novo !== primeiro) {
        setShake(true);
        setError(true);
        window.setTimeout(() => {
          if (cancelled) return;
          setShake(false);
          setError(false);
          setDigits([]);
          setPrimeiro(null);
          setEtapa("novo");
        }, 700);
        return () => {
          cancelled = true;
        };
      }
      setVerifying(true);
      void (async () => {
        const hash = await hashPin(novo);
        const gravou = await reauth.gravarPin(usuarioId, hash);
        if (cancelled) return;
        if (!gravou) {
          setFalhaAoGravar(true);
          setDigits([]);
          setPrimeiro(null);
          setVerifying(false);
          setEtapa("novo");
          return;
        }
        zerarTentativas(usuarioId);
        setTentativas(SEM_TENTATIVAS);
        setUnlocked(true);
        unlockTimer = window.setTimeout(() => {
          if (cancelled) return;
          onPinRedefinido?.(hash);
          unlock();
        }, 200);
      })();
      return () => {
        cancelled = true;
        if (unlockTimer) window.clearTimeout(unlockTimer);
      };
    }

    setVerifying(true);

    verifyPin(digits.join(""), pinHash).then((ok) => {
      if (ok) {
        onUnlock();
        zerarTentativas(usuarioId);
        return;
      }
      // O erro conta ANTES do `cancelled`: sair da tela logo depois do 4º
      // dígito não escapa do contador. Lido de novo do aparelho: a trava do
      // app e a do Cofre dividem o mesmo contador.
      const depois = registrarErro(lerTentativas(usuarioId), Date.now());
      gravarTentativas(usuarioId, depois);
      if (cancelled) return;
      setTentativas(depois);
      setAgora(Date.now());

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
  }, [
    digits,
    pinHash,
    unlock,
    etapa,
    primeiro,
    usuarioId,
    reauth,
    onPinRedefinido,
  ]);

  function press(key: string) {
    if (verifying || emEspera) return;
    if (key === "del") {
      setDigits((current) => current.slice(0, -1));
    } else if (key) {
      setFalhaAoGravar(false);
      setDigits((current) =>
        current.length < 4 ? [...current, key] : current
      );
    }
  }

  function voltarAoTeclado() {
    setDigits([]);
    setPrimeiro(null);
    setFalhaAoGravar(false);
    setEtapa("teclado");
  }

  // Volta do Google ("Esqueci o PIN" pelo Google): a confirmação vale uma
  // vez, e o ref segura a resposta no remonte do StrictMode.
  const retornoGoogle = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    if (!retornoGoogle.current) {
      if (reauth.motivoPendente() !== "esqueci-pin") return;
      retornoGoogle.current = reauth.retornoDoGoogle("esqueci-pin");
    }
    let vivo = true;
    void retornoGoogle.current.then((ok) => {
      limparReauthDaUrl();
      if (vivo && ok) {
        setDigits([]);
        setEtapa("novo");
      }
    });
    return () => {
      vivo = false;
    };
  }, [reauth]);

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

  // Teclado físico (computador, teclado bluetooth): 0–9 e Backspace. Fora
  // na confirmação da conta (a senha é digitada no campo dela).
  useEffect(() => {
    if (etapa === "reauth") return;
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pinNovo = etapa === "novo" || etapa === "confirmar";
  const estado = unlocked
    ? "ok"
    : error
      ? "err"
      : emEspera
        ? "espera"
        : undefined;
  const mensagem = error
    ? etapa === "confirmar"
      ? "Os dois PINs não são iguais. Comece de novo."
      : "Esse PIN não confere. Tente de novo."
    : unlocked
      ? "Tudo certo, abrindo…"
      : verifying
        ? pinNovo
          ? "Salvando o PIN novo…"
          : "Verificando…"
        : emEspera
          ? `Muitas tentativas. Tente de novo em ${formatarEspera(espera)}.`
          : falhaAoGravar
            ? "Não foi possível salvar o PIN. Tente de novo."
            : etapa === "novo"
              ? "Digite 4 números para o PIN novo."
              : etapa === "confirmar"
                ? "Digite o PIN novo mais uma vez."
                : vault
                  ? "Digite seu PIN para ver seus arquivos protegidos."
                  : "Confirme que é você para entrar no JobApp.";
  const titulo = unlocked
    ? pinNovo
      ? "PIN novo salvo"
      : "Acesso liberado"
    : etapa === "novo"
      ? "Crie um PIN novo"
      : etapa === "confirmar"
        ? "Confirme o PIN novo"
        : vault
          ? "Abra seu Cofre"
          : "Digite seu PIN";

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
              {titulo}
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
            className={`${digits.length > index || unlocked ? styles.filled : ""} ${digits.length === index && !error && !unlocked && !verifying && !emEspera ? styles.current : ""}`}
          />
        ))}
      </div>

      <p className={styles.msg} aria-live="polite" data-pin-mensagem>
        {mensagem}
      </p>

      <div className={styles.sheet}>
        {etapa === "reauth" ? (
          <div key="reauth" className={styles.ajuda} data-pin-ajuda>
            <ReauthModal
              inline
              open
              motivo="esqueci-pin"
              adapter={reauth}
              onClose={voltarAoTeclado}
              onConfirmado={() => {
                setDigits([]);
                setEtapa("novo");
              }}
              onSair={onSair}
            />
          </div>
        ) : (
          // Chaves distintas nos dois ramos: sem elas o React reaproveitava
          // um botão do teclado dentro do painel (um "9" sobrando).
          <div key="teclado">
            <div className={styles.pad} aria-label="Teclado do PIN">
              {KEYS.map((key, index) => {
                // Chave própria: com `key={index}` (9) a casa vazia
                // colidia com a tecla "9".
                if (!key) return <span key="vazio" aria-hidden="true" />;
                const isDelete = key === "del";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => press(key)}
                    disabled={verifying || emEspera}
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
            {pinNovo ? (
              <button
                type="button"
                className={styles.forgot}
                onClick={voltarAoTeclado}
                data-pin-novo-cancelar
              >
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                className={styles.forgot}
                onClick={() => setEtapa("reauth")}
                data-pin-esqueci
              >
                Esqueci o PIN
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
