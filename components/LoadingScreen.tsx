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
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={styles.puff} />
      ))}
      <div className={styles.logo}>
        <span className={styles.logoText}>JobApp</span>
      </div>
    </div>
  );
}
