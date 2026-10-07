"use client";

import { Fragment } from "react";
import { formatBRL } from "@/lib/finance";
import type { Job } from "@/lib/types";
import { InicioCard } from "./InicioCard";
import {
  diasComAtendimentoDaSemana,
  formatHora,
  rotuloDiaCurto,
} from "./inicioAgenda";

interface Props {
  jobs: Job[];
  onGoToAgenda: () => void;
}


/**
 * Seção "Esta semana" da Início (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`): de hoje até domingo, só os dias
 * com atendimento, um atendimento por linha. Semana sem nenhum atendimento
 * mostra uma linha "Semana livre". O atalho
 * "Agenda ›" leva à aba Agenda.
 */
export function SemanaSection({ jobs, onGoToAgenda }: Props) {
  const dias = diasComAtendimentoDaSemana(jobs);
  // Valores do mockup normativo (tela Início, "Esta semana").
  const linhaStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 0",
  } as const;
  const BORDA = { borderBottom: "1px solid var(--t-line)" } as const;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "8px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>
          Esta semana
        </h2>
        <button
          type="button"
          onClick={onGoToAgenda}
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--t-deep)",
            background: "none",
            border: 0,
            padding: 0,
          }}
        >
          Agenda ›
        </button>
      </div>

      <InicioCard style={{ padding: "6px 16px" }}>
        {dias.length === 0 && (
          <div
            style={{ ...linhaStyle, fontSize: "13px", color: "var(--t-mut)" }}
          >
            Semana livre
          </div>
        )}
        {dias.map((dia, i) => {
          const borda = i < dias.length - 1 ? BORDA : undefined;
          const rotulo = (
            <span
              style={{
                width: "40px",
                flexShrink: 0,
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--t-mut)",
              }}
            >
              {rotuloDiaCurto(dia.data)}
            </span>
          );

          return (
            <Fragment key={dia.data}>
              {dia.jobs.map((job, j) => (
                <div
                  key={job.id}
                  style={{
                    ...linhaStyle,
                    ...(j < dia.jobs.length - 1 ? BORDA : borda),
                  }}
                >
                  {j === 0 ? (
                    rotulo
                  ) : (
                    <span style={{ width: "40px", flexShrink: 0 }} />
                  )}
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div
                      className="truncate"
                      style={{ fontSize: "14px", fontWeight: 700 }}
                    >
                      {job.clienteNome}
                    </div>
                    <div
                      className="truncate"
                      style={{ fontSize: "11px", color: "var(--t-mut)" }}
                    >
                      {formatHora(job.hora)} ·{" "}
                      {job.modalidade === "online"
                        ? "Online"
                        : (job.local ?? "Presencial")}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "var(--t-deep)",
                      flexShrink: 0,
                    }}
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
