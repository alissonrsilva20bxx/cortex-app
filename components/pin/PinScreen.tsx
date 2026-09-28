"use client";

import { useEffect, useState } from "react";
import { Delete, LockKeyhole, ShieldCheck } from "lucide-react";
import { verifyPin } from "@/lib/pin";
import styles from "./PinScreen.module.css";

/**
 * Teclado T9 circular — igual ao aprovado em /dev-preview/ios (ticket
 * #138): dígito + letras (ABC/DEF/...) sob cada botão redondo, mesmo
 * mapa de letras do protótipo (`IosPrototypeApp.tsx` `pinKeys`). `key`
 * é o valor real usado por `press()` (dígito, `"del"` pra apagar, ou
 * `""` pro espaço em branco do grid 3×4); `letters` é só rótulo visual.
 */
const KEYS: { key: string; letters: string }[] = [
  { key: "1", letters: "" },
  { key: "2", letters: "ABC" },
  { key: "3", letters: "DEF" },
  { key: "4", letters: "GHI" },
  { key: "5", letters: "JKL" },
  { key: "6", letters: "MNO" },
  { key: "7", letters: "PQRS" },
  { key: "8", letters: "TUV" },
  { key: "9", letters: "WXYZ" },
  { key: "", letters: "" },
  { key: "0", letters: "" },
  { key: "del", letters: "" },
];

interface Props {
  pinHash: string;
  onUnlock: () => void;
  context?: "app" | "vault";
}

export function PinScreen({
  pinHash,
  onUnlock: unlock,
  context = "app",
}: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
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

  return (
    <main
      className={`${styles.page} fixed inset-0 z-[100]`}
      data-vault={vault ? "true" : "false"}
      data-unlocked={unlocked ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-screen-title"
      tabIndex={-1}
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className={styles.atmosphere} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className={styles.content}>
        <span className={styles.wordmark}>JobApp</span>

        <div className={styles.intro}>
          <div className={styles.lockSeal}>
            <LockKeyhole size={27} />
          </div>
          <h1 id="pin-screen-title">
            {vault ? "Abra seu cofre" : "Digite seu PIN"}
          </h1>
          <p aria-live="polite">
            {error
              ? "Esse PIN não confere. Tente novamente."
              : unlocked
                ? "Acesso liberado."
                : verifying
                  ? "Verificando…"
                  : vault
                    ? "Digite seu PIN para acessar seus arquivos protegidos."
                    : "Confirme sua identidade para entrar no JobApp."}
          </p>
        </div>

        <div
          className={styles.dots}
          data-unlocked={unlocked ? "true" : "false"}
          style={{ animation: shake ? "pinShake 0.4s ease" : "none" }}
          aria-label={`${digits.length} de 4 dígitos preenchidos`}
        >
          {[0, 1, 2, 3].map((index) => (
            <i
              key={index}
              className={`${digits.length > index ? styles.dotFilled : ""} ${error ? styles.dotInvalid : ""}`}
            />
          ))}
        </div>

        <div className={styles.keypad} aria-label="Teclado do PIN">
          {KEYS.map(({ key, letters }, index) => {
            if (!key) return <span key={index} aria-hidden="true" />;
            const isDelete = key === "del";
            return (
              <button
                key={`${key}-${index}`}
                type="button"
                onClick={() => press(key)}
                disabled={verifying}
                aria-label={isDelete ? "Apagar último dígito" : `Dígito ${key}`}
              >
                {isDelete ? (
                  <Delete size={22} />
                ) : (
                  <>
                    <strong>{key}</strong>
                    {letters && <small>{letters}</small>}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className={styles.privacy}>
          <ShieldCheck size={14} aria-hidden="true" />
          {vault
            ? "O Cofre será bloqueado novamente quando você sair desta área."
            : "Seu espaço permanece protegido neste aparelho."}
        </p>
      </div>

      <style>{`@keyframes pinShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 50% { transform: translateX(7px); } 75% { transform: translateX(-4px); } }`}</style>
    </main>
  );
}
