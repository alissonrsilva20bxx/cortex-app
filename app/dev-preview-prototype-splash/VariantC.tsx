"use client";

// PROTOTYPE-ONLY. "Respiração calorosa" — the icon badge spring-settles
// with a soft ink bloom, then the wordmark letters stagger in one by one
// (not typewriter — an editorial, unhurried reveal), closest in spirit
// to the current splash but with real choreography instead of one flat
// pulse.

import styles from "./variants.module.css";

const LETTERS = "JobApp".split("");

export function VariantC() {
  return (
    <div className={styles.overlay}>
      <div className={styles.glowC} />
      <div className={styles.bloomC} />

      <div className={styles.badgeC}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
            stroke="var(--accent)"
            strokeWidth="1.7"
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
            strokeWidth="1.7"
          />
          <path
            d="M9 12h6M9 16h4"
            stroke="var(--accent)"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className={styles.wordmarkRowC}>
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            className={styles.letterC}
            style={{ animationDelay: `${0.5 + i * 0.045}s` }}
          >
            {ch}
          </span>
        ))}
      </div>

      <span className={styles.chipC}>no seu ritmo</span>
    </div>
  );
}
