"use client";

// PROTOTYPE-ONLY. "Composição cinematográfica" — bottom-anchored, like a
// Threads/Instagram auth sheet. Big atmospheric negative space up top,
// content pinned to the bottom edge. No glass card at all — the button
// sits directly on the atmosphere.

import { GoogleButton } from "./GoogleButton";
import styles from "./login-variants.module.css";

interface Props {
  loading: boolean;
  onGoogleLogin: () => void;
}

export function VariantC({ loading, onGoogleLogin }: Props) {
  return (
    <div className={styles.wrapC}>
      <div className={styles.atmosphereC} />

      <div className={styles.markC}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
            stroke="var(--accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="9"
            y="3"
            width="6"
            height="4"
            rx="1.5"
            stroke="var(--accent)"
            strokeWidth="1.8"
          />
        </svg>
        <span
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          JobApp
        </span>
      </div>

      <div className={styles.bottomBlockC}>
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-2)",
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Cada atendimento, mais perto da sua independência — no seu ritmo.
        </p>
        <GoogleButton loading={loading} onClick={onGoogleLogin} />
        <p
          style={{
            marginTop: 14,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--text-muted)",
          }}
        >
          Ao entrar, você concorda com os termos de uso e política de
          privacidade.
        </p>
      </div>
    </div>
  );
}
