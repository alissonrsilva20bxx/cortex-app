"use client";

// PROTOTYPE-ONLY. "Traço vivo" — reuses the app's own progress-bar glow
// language: a brand line draws itself (with a spark riding its tip),
// then the wordmark wipes in under it like it's being written. Small
// "R$" glyphs drift up through an ambient colored wash behind everything
// — a literal, on-brand nod to "cada atendimento constrói" instead of
// generic bokeh. No icon badge — purely typographic, the most different
// of the three.

import styles from "./variants.module.css";

const CASH = [
  { left: "12%", size: 13, duration: 7, delay: 0, drift: 18, op: 0.16 },
  { left: "82%", size: 18, duration: 8.5, delay: 0.6, drift: -14, op: 0.14 },
  { left: "24%", size: 22, duration: 9.5, delay: 1.4, drift: 10, op: 0.12 },
  { left: "68%", size: 14, duration: 6.5, delay: 2.1, drift: -20, op: 0.2 },
  { left: "45%", size: 16, duration: 10, delay: 0.3, drift: 8, op: 0.1 },
  { left: "90%", size: 12, duration: 7.5, delay: 2.8, drift: -10, op: 0.18 },
  { left: "6%", size: 20, duration: 9, delay: 1.8, drift: 16, op: 0.13 },
  { left: "58%", size: 11, duration: 6, delay: 3.4, drift: -8, op: 0.22 },
  { left: "35%", size: 15, duration: 8, delay: 4, drift: 12, op: 0.15 },
];

export function VariantB() {
  return (
    <div className={styles.overlay}>
      <div className={styles.atmosphereB} />

      {CASH.map((c, i) => (
        <span
          key={i}
          className={styles.cashB}
          style={
            {
              left: c.left,
              fontSize: c.size,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
              "--cash-drift": `${c.drift}px`,
              "--cash-op": c.op,
            } as React.CSSProperties
          }
        >
          R$
        </span>
      ))}

      <div className={styles.lineB}>
        <span className={styles.sparkB} />
      </div>
      <span className={styles.wordmarkB}>JobApp</span>
      <span className={styles.chipB}>no seu ritmo</span>
    </div>
  );
}
