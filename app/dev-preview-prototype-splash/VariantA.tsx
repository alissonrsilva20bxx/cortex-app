"use client";

// PROTOTYPE-ONLY. "Constelação" — small particles drift inward and
// converge into a burst right as the icon draws itself (SVG stroke
// reveal), then the wordmark and tagline fade up. No static badge —
// the mark visibly assembles instead of just appearing.

import styles from "./variants.module.css";

const PARTICLES = [
  { tx: -120, ty: -70, delay: 0 },
  { tx: 110, ty: -90, delay: 0.05 },
  { tx: -90, ty: 80, delay: 0.1 },
  { tx: 130, ty: 60, delay: 0.02 },
  { tx: -150, ty: 10, delay: 0.08 },
  { tx: 150, ty: -10, delay: 0.03 },
  { tx: -60, ty: -120, delay: 0.12 },
  { tx: 70, ty: 120, delay: 0.06 },
  { tx: -30, ty: 130, delay: 0.15 },
  { tx: 40, ty: -130, delay: 0.09 },
  { tx: -140, ty: -40, delay: 0.11 },
  { tx: 100, ty: 100, delay: 0.04 },
];

export function VariantA() {
  return (
    <div className={styles.overlay}>
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className={styles.particleA}
          style={
            {
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
      <div className={styles.burstA} />

      <svg
        className={styles.iconA}
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          className={styles.strokeA}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
          stroke="var(--accent)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          className={styles.strokeA}
          x="9"
          y="3"
          width="6"
          height="4"
          rx="1.5"
          stroke="var(--accent)"
          strokeWidth="1.7"
        />
        <path
          className={styles.strokeA}
          d="M9 12h6M9 16h4"
          stroke="var(--accent)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>

      <span className={styles.wordmarkA}>JobApp</span>
      <span className={styles.taglineA}>no seu ritmo</span>
    </div>
  );
}
