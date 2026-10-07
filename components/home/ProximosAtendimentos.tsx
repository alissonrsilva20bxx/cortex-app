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

  // Valores do mockup normativo (tela Início, "Próximos atendimentos").
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h2 style={{ margin: "6px 0 0", fontSize: "15px", fontWeight: 800 }}>
        Próximos atendimentos
      </h2>
      <InicioCard style={{ padding: "4px 16px" }}>
        {proximos.map((job, i) => (
          <div
            key={job.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 0",
              ...(i < proximos.length - 1
                ? { borderBottom: "1px solid var(--t-line)" }
                : undefined),
            }}
          >
            <span
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "var(--t-soft)",
                color: "var(--t-deep)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                flexShrink: 0,
              }}
              aria-hidden
            >
              {job.clienteNome.charAt(0).toUpperCase()}
            </span>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div
                className="truncate"
                style={{ fontSize: "14px", fontWeight: 700 }}
              >
                {job.clienteNome}
              </div>
              <div style={{ fontSize: "11px", color: "var(--t-mut)" }}>
                {rotuloDiaFrase(job.data)} · {formatHora(job.hora)}
              </div>
            </div>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: "var(--t-ink)",
                flexShrink: 0,
              }}
            >
              {formatBRL(job.valor)}
            </span>
          </div>
        ))}
      </InicioCard>
    </section>
  );
}
