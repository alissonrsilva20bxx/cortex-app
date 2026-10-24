import styles from "./MarcaNome.module.css";

/** "Arcelle" na letra da marca, com "elle" em rosa. */
export function MarcaNome({ className }: { className?: string }) {
  return (
    <span
      className={className ? `${styles.nome} ${className}` : styles.nome}
      aria-label="Arcelle"
    >
      <span aria-hidden="true">Arc</span>
      <span className={styles.elle} aria-hidden="true">
        elle
      </span>
    </span>
  );
}
