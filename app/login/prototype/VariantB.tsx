"use client";

// PROTOTYPE-ONLY. "Prévia da projeção" — the dominant element is a
// teaser of the product's actual value (a blurred HeroCard-shaped
// preview with a lock), not a login form. Sells the "aha" before asking
// for the tap. The Google button becomes a supporting element beneath.

import { Lock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GoogleButton } from "./GoogleButton";
import styles from "./login-variants.module.css";

interface Props {
  loading: boolean;
  onGoogleLogin: () => void;
}

export function VariantB({ loading, onGoogleLogin }: Props) {
  return (
    <div className={styles.wrapB}>
      <div className={styles.lockupB}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgb(var(--accent-rgb) / 0.14)",
            border: "1px solid rgb(var(--accent-rgb) / 0.22)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
              stroke="var(--accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>
          JobApp
        </span>
      </div>

      <GlassCard radius="xl" className={styles.teaserCardB}>
        <div className={styles.blurRowB}>
          <p className="section-label">Você já construiu</p>
          <p
            style={{
              marginTop: 8,
              fontSize: 36,
              fontWeight: 900,
              color: "var(--accent)",
            }}
          >
            R$ 3.240
          </p>
          <div className="progress-track" style={{ marginTop: 16 }}>
            <div className="progress-fill" style={{ width: "62%" }} />
          </div>
        </div>

        <div className={styles.lockOverlayB}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgb(var(--bg-rgb) / 0.7)",
              border: "1px solid rgb(var(--accent-rgb) / 0.25)",
            }}
          >
            <Lock size={18} style={{ color: "var(--accent)" }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Sua projeção te espera
          </p>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              maxWidth: 220,
            }}
          >
            Entre pra ver, no seu ritmo, o quanto você já construiu.
          </p>
        </div>
      </GlassCard>

      <div className={styles.ctaWrapB}>
        <GoogleButton loading={loading} onClick={onGoogleLogin} />
      </div>
    </div>
  );
}
