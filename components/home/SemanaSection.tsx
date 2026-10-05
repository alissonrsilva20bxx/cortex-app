"use client";

import { Fragment } from "react";
import { formatBRL } from "@/lib/finance";
import type { Job } from "@/lib/types";
import { InicioCard } from "./InicioCard";
import {
  diasRestantesDaSemana,
  formatHora,
  rotuloDiaCurto,
} from "./inicioAgenda";

interface Props {
  jobs: Job[];
  onGoToAgenda: () => void;
}

const linha = "flex items-center gap-3 py-3";

/**
 * Seção "Esta semana" da Início (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`): de hoje até domingo, um dia por
 * linha; dia sem atendimento aparece como "Dia livre". O atalho
 * "Agenda ›" leva à aba Agenda.
 */
export function SemanaSection({ jobs, onGoToAgenda }: Props) {
  const dias = diasRestantesDaSemana(jobs);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold" style={{ fontSize: "15px" }}>
          Esta semana
        </h2>
        <button
          type="button"
          onClick={onGoToAgenda}
          className="font-bold"
          style={{
            fontSize: "12px",
            color: "var(--accent-deep)",
            minHeight: "44px",
            padding: "0 4px",
          }}
        >
          Agenda ›
        </button>
      </div>

      <InicioCard style={{ padding: "6px 16px" }}>
        {dias.map((dia, i) => {
          const borda =
            i < dias.length - 1
              ? { borderBottom: "1px solid var(--card-border)" }
              : undefined;
          const rotulo = (
            <span
              className="font-bold shrink-0"
              style={{
                width: "48px",
                whiteSpace: "nowrap",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              {rotuloDiaCurto(dia.data)}
            </span>
          );

          if (dia.jobs.length === 0) {
            return (
              <div key={dia.data} className={linha} style={borda}>
                {rotulo}
                <span
                  className="flex-grow"
                  style={{ fontSize: "13px", color: "var(--text-muted)" }}
                >
                  Dia livre
                </span>
              </div>
            );
          }

          return (
            <Fragment key={dia.data}>
              {dia.jobs.map((job, j) => (
                <div
                  key={job.id}
                  className={linha}
                  style={
                    j < dia.jobs.length - 1
                      ? { borderBottom: "1px solid var(--card-border)" }
                      : borda
                  }
                >
                  {j === 0 ? (
                    rotulo
                  ) : (
                    <span className="shrink-0" style={{ width: "48px" }} />
                  )}
                  <div className="min-w-0 flex-grow">
                    <p
                      className="font-bold truncate"
                      style={{ fontSize: "14px" }}
                    >
                      {job.clienteNome}
                    </p>
                    <p
                      className="truncate"
                      style={{ fontSize: "11px", color: "var(--text-muted)" }}
                    >
                      {formatHora(job.hora)} ·{" "}
                      {job.modalidade === "online"
                        ? "Online"
                        : (job.local ?? "Presencial")}
                    </p>
                  </div>
                  <span
                    className="font-extrabold tabular-nums shrink-0"
                    style={{ fontSize: "13px", color: "var(--accent-deep)" }}
                  >
                    {formatBRL(job.valor)}
                  </span>
                </div>
              ))}
            </Fragment>
          );
        })}
      </InicioCard>
    </section>
  );
}
