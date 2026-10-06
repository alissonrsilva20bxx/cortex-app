"use client";

import { ArrowUpRight } from "lucide-react";
import { formatBRL, monthProjection } from "@/lib/finance";
import type { Job, Meta } from "@/lib/types";
import { InicioCard } from "./InicioCard";

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
    <InicioCard
      onClick={onGoToFinanceiro}
      className="flex flex-col gap-2"
      style={{ padding: "16px" }}
    >
      <ArrowUpRight
        size={20}
        style={{ color: "var(--accent-deep)" }}
        aria-hidden
      />
      <span
        className="font-semibold"
        style={{ fontSize: "11px", color: "var(--text-muted)" }}
      >
        Falta pra meta
      </span>
      <span
        className="font-extrabold tabular-nums leading-none truncate"
        style={{ fontSize: "20px" }}
      >
        {formatBRL(p.remaining)}
      </span>
    </InicioCard>
  );
}
