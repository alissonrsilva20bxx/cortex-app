"use client";

import { formatBRL, monthProjection } from "@/lib/finance";
import type { Job, Meta } from "@/lib/types";
import { InicioCard } from "./InicioCard";
import {
  CARD_PEQUENO,
  IconeCard,
  ROTULO_CARD,
  VALOR_CARD,
} from "./pecasMockup";

interface Props {
  jobs: Job[];
  metas: Meta[];
  onGoToFinanceiro: () => void;
}

/**
 * Card "Falta pra meta" da grade da Início (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`). O valor é o `remaining` de
 * `monthProjection` -- a mesma conta que o card principal já usava pra
 * "Faltam R$ X". Sem meta definida não há o que faltar: o card não
 * aparece, em vez de mostrar um número inventado.
 */
export function FaltaMetaCard({ jobs, metas, onGoToFinanceiro }: Props) {
  const p = monthProjection(jobs, metas);
  if (p.meta === null || p.remaining === null) return null;

  return (
    <InicioCard onClick={onGoToFinanceiro} style={CARD_PEQUENO}>
      <IconeCard>
        <path d="M7 17 17 7M7 7h10v10" />
      </IconeCard>
      <span style={ROTULO_CARD}>Falta pra meta</span>
      <span className="truncate" style={VALOR_CARD}>
        {formatBRL(p.remaining)}
      </span>
    </InicioCard>
  );
}
