"use client";

import { formatBRL } from "@/lib/finance";
import type { Job } from "@/lib/types";
import { InicioCard } from "./InicioCard";
import {
  atendimentosDepoisDaSemana,
  formatHora,
  rotuloDiaFrase,
} from "./inicioAgenda";

interface Props {
  jobs: Job[];
}

/**
 * Seção "Próximos atendimentos" da Início (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`): os atendimentos depois desta
 * semana (a semana corrente já aparece em "Esta semana"), com a inicial,
 * o nome, "<dia> · <hora>" e o valor. Sem nenhum, a seção não aparece.
 */
export function ProximosAtendimentos({ jobs }: Props) {
  const proximos = atendimentosDepoisDaSemana(jobs);
  if (proximos.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-extrabold" style={{ fontSize: "15px" }}>
        Próximos atendimentos
      </h2>
      <InicioCard style={{ padding: "4px 16px" }}>
        {proximos.map((job, i) => (
          <div
            key={job.id}
            className="flex items-center gap-3 py-3"
            style={
              i < proximos.length - 1
                ? { borderBottom: "1px solid var(--card-border)" }
                : undefined
            }
          >
            <span
              className="grid place-items-center shrink-0 font-extrabold"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent-tint)",
                color: "var(--accent-deep)",
              }}
              aria-hidden
            >
              {job.clienteNome.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-grow">
              <p className="font-bold truncate" style={{ fontSize: "14px" }}>
                {job.clienteNome}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {rotuloDiaFrase(job.data)} · {formatHora(job.hora)}
              </p>
            </div>
            <span
              className="font-extrabold tabular-nums shrink-0"
              style={{ fontSize: "14px" }}
            >
              {formatBRL(job.valor)}
            </span>
          </div>
        ))}
      </InicioCard>
    </section>
  );
}
