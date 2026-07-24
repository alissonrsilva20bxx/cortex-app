"use client";

// PROTOTYPE-ONLY. "Masthead editorial" — no enclosing card at all. The
// positioning line IS the hero, top-anchored like an editorial title
// page; the wordmark shrinks to a small byline above it.

import { GoogleButton } from "./GoogleButton";
import styles from "./login-variants.module.css";

interface Props {
  loading: boolean;
  onGoogleLogin: () => void;
}

export function VariantA({ loading, onGoogleLogin }: Props) {
  return (
    <div className={styles.wrapA}>
      <div className={styles.kickerA}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          JobApp
        </span>
      </div>

      <h1 className={styles.headlineA}>
        Cada atendimento, mais perto da sua independência.
      </h1>

      <div className={styles.spacerA} />

      <div className={styles.ctaBlockA}>
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
