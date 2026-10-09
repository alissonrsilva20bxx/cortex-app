"use client";

import styles from "@/components/onboarding/linhaDoTempo.module.css";
import { Icone } from "@/components/onboarding/obIcones";
import {
  BOTTOM_NAV_FAB_SIZE,
  BOTTOM_NAV_OFFSET,
} from "@/lib/bottomNavCompactStyle";

/** 14px acima da barra de abas, como no desenho (24 + 60 + 14 = 98 lá; a
 * barra do app fica a 22 do fundo). */
const BOTTOM = BOTTOM_NAV_OFFSET + BOTTOM_NAV_FAB_SIZE + 14;

interface Props {
  /** Quantos dias faltam (7 no 1º dia, 1 no último). */
  faltam: number;
  /** Dias já passados, para as bolinhas. */
  feitos: number;
  /** O teste desta conta (7, ou 14 para quem começou antes do corte): uma
   * bolinha por dia. */
  total: number;
  ultimo: boolean;
  /** Só no último dia: abre a escolha de plano. */
  onVerPlanos: () => void;
}

/**
 * A pílula do contador do teste grátis (tela 4 do desenho "Linha do
 * tempo"): flutua acima da barra de abas, no Início, durante o teste.
 * Discreta nos dias normais (só informa); no último dia ganha o acento e o
 * atalho "Ver planos".
 */
export function PilulaTeste({
  faltam,
  feitos,
  total,
  ultimo,
  onVerPlanos,
}: Props) {
  const estilo = { "--ob-pilula-bottom": `${BOTTOM}px` } as React.CSSProperties;
  if (ultimo) {
    return (
      <button
        type="button"
        className={`${styles.trial} ${styles.last}`}
        style={estilo}
        onClick={onVerPlanos}
        aria-label="Último dia do teste grátis. Ver planos"
        data-pilula-teste="ultimo"
      >
        <span className={styles.gift}>
          <Icone n="gift" s={16} />
        </span>
        <span className={styles.tx}>
          Último dia <span>do teste</span>
        </span>
        <span className={styles.go}>Ver planos</span>
      </button>
    );
  }
  return (
    <div
      role="status"
      className={styles.trial}
      style={estilo}
      aria-label={`Teste grátis: faltam ${faltam} dias`}
      data-pilula-teste={faltam}
    >
      <span className={styles.gift}>
        <Icone n="gift" s={16} />
      </span>
      <span className={styles.tx}>
        Faltam {faltam} dias <span>de teste</span>
      </span>
      <span className={styles.seg7} aria-hidden="true">
        {Array.from({ length: total }, (_, k) => (
          <i key={k} className={k < feitos ? styles.on : undefined} />
        ))}
      </span>
    </div>
  );
}
