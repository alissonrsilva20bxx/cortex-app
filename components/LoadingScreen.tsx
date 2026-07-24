"use client";

import { useEffect, useState } from "react";
import styles from "./LoadingScreen.module.css";

interface Props {
  isLoading: boolean;
}

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
      <div className={styles.glow} />

      <div className={styles.logo}>
        <div className={styles.iconBadge}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
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
        <span className={styles.logoText}>JobApp</span>
        <span className={styles.tagline}>no seu ritmo</span>
      </div>
    </div>
  );
}
