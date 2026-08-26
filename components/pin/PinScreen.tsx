"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { verifyPin } from "@/lib/pin";
import styles from "./PinScreen.module.css";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

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
      <div className={styles.atmosphere} aria-hidden="true" />
      <header className={styles.header}>
        <span className={styles.wordmark}>JobApp</span>
        {vault ? <span className={styles.contextLabel}>Cofre</span> : null}
      </header>

      <section className={styles.content}>
        <div className={styles.copy}>
          <h1 id="pin-screen-title">
            {vault ? "Abra seu cofre." : "Digite seu PIN."}
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
          className={styles.pinRail}
          style={{ animation: shake ? "pinShake 0.4s ease" : "none" }}
          aria-label={`${digits.length} de 4 dígitos preenchidos`}
        >
          {[0, 1, 2, 3].map((index) => (
            <i
              key={index}
              className={`${digits.length > index ? styles.filled : ""} ${error ? styles.invalid : ""}`}
            />
          ))}
        </div>

        <div className={styles.keypad} aria-label="Teclado do PIN">
          {KEYS.map((key, index) => {
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
                {isDelete ? <Delete size={19} /> : key}
              </button>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <p>
            {vault
              ? "O Cofre será bloqueado novamente quando você sair desta área."
              : "Seu espaço permanece protegido neste aparelho."}
          </p>
        </footer>
      </section>

      <style>{`@keyframes pinShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 50% { transform: translateX(7px); } 75% { transform: translateX(-4px); } }`}</style>
    </main>
  );
}
