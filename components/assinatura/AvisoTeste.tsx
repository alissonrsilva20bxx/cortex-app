"use client";

import styles from "@/components/onboarding/linhaDoTempo.module.css";
import { Icone } from "@/components/onboarding/obIcones";
import {
  BOTTOM_NAV_FAB_SIZE,
  BOTTOM_NAV_OFFSET,
} from "@/lib/bottomNavCompactStyle";

/** No lugar da pílula, acima da barra de abas. */
const BOTTOM = BOTTOM_NAV_OFFSET + BOTTOM_NAV_FAB_SIZE + 14;

interface Props {
  /** Quantos dias faltam (o mesmo número da pílula naquele dia). */
  faltam: number;
  /** Abre a escolha de plano. */
  onVerPlanos: () => void;
  /** Fecha o aviso e volta a pílula. */
  onFechar: () => void;
}

/**
 * O aviso que a tela 3 do onboarding promete ("A gente te avisa · Um
 * lembrete de que faltam 2 dias"): aparece no Início uma vez, no dia em que
 * a pílula mostra 2. Sem servidor: é o app que decide ao abrir. Não trava
 * nada; "Ok" fecha.
 */
export function AvisoTeste({ faltam, onVerPlanos, onFechar }: Props) {
  return (
    <div
      role="status"
      className={styles.aviso}
      style={{ "--ob-pilula-bottom": `${BOTTOM}px` } as React.CSSProperties}
      data-aviso-teste={faltam}
    >
      <span className={styles.gift}>
        <Icone n="bell" s={16} />
      </span>
      <span className={styles.avisoTx}>
        <b>Faltam {faltam} dias do seu teste</b>
        <small>Depois, é só escolher um plano para continuar.</small>
      </span>
      <span className={styles.avisoAcoes}>
        <button
          type="button"
          className={styles.avisoPlanos}
          onClick={onVerPlanos}
          data-aviso-ver-planos
        >
          Ver planos
        </button>
        <button
          type="button"
          className={styles.avisoOk}
          onClick={onFechar}
          data-aviso-ok
        >
          Ok
        </button>
      </span>
    </div>
  );
}
