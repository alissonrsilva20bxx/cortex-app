"use client";

import { useEffect, useState } from "react";
import styles from "./LoadingScreen.module.css";

interface Props {
  isLoading: boolean;
}

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

export function LoadingScreen({ isLoading }: Props) {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      // Wait for the fade-out transition before unmounting
      const t = setTimeout(() => setMounted(false), 520);
      return () => clearTimeout(t);
    }
    setMounted(true);
  }, [isLoading]);

  if (!mounted) return null;

  return (
    <div
      className={`${styles.overlay}${!isLoading ? ` ${styles.hidden}` : ""}`}
    >
      <div className={styles.atmosphere} />

      {CASH.map((c, i) => (
        <span
          key={i}
          className={styles.cash}
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

      <div className={styles.line}>
        <span className={styles.spark} />
      </div>
      <span className={styles.wordmark}>JobApp</span>
      <span className={styles.chip}>no seu ritmo</span>
    </div>
  );
}
