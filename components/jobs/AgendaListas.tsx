"use client";

import { CalendarCheck, Check, Clock3, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatBRL } from "@/lib/finance";
import type { Job, JobStatus } from "@/lib/types";
import { STATUS_META } from "./status";
import { formatDiaCurto, formatHora, inicialDoNome } from "./agendaSemana";

/** Ícone de cada status. Cor e rótulo continuam vindo de `STATUS_META`. */
const STATUS_ICON: Record<JobStatus, LucideIcon> = {
  agendado: Clock3,
  confirmado: CalendarCheck,
  concluído: Check,
  cancelado: X,
};

const SECTION_TITLE_STYLE = {
  fontSize: "15px",
  fontWeight: 800,
  color: "var(--text)",
} as const;

const LIST_STYLE = {
  background: "var(--card-solid)",
  borderRadius: "20px",
  padding: "4px 16px",
} as const;

function ListaVazia() {
  return (
    <p
      className="py-4 text-center"
      style={{ fontSize: "12px", color: "var(--text-muted)" }}
    >
      Nenhum atendimento
    </p>
  );
}

function Linha({
  job,
  isLast,
  marca,
  detalhe,
  valor,
  onOpen,
}: {
  job: Job;
  isLast: boolean;
  marca: ReactNode;
  detalhe: string;
  valor: string;
  onOpen: (job: Job) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(job)}
      className="flex w-full items-center text-left active:opacity-70"
      style={{
        gap: "12px",
        padding: "12px 0",
        minHeight: "44px",
        borderBottom: isLast ? "none" : "1px solid var(--divider)",
      }}
    >
      {marca}
      <span className="min-w-0 flex-1">
        <span
          className="block truncate"
          style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}
        >
          {job.clienteNome}
        </span>
        <span
          className="block truncate"
          style={{ fontSize: "11px", color: "var(--text-muted)" }}
        >
          {detalhe}
        </span>
      </span>
      <strong
        className="shrink-0 tabular-nums"
        style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)" }}
      >
        {valor}
      </strong>
    </button>
  );
}

/**
 * Seção "Esta semana" (J03): todos os atendimentos da semana real da
 * usuária, cada um com `dia · hora · status`. O status é o rótulo de
 * `STATUS_META`, sem texto novo. "Ver tudo ›" fica desabilitado: o app
 * não tem hoje uma tela de lista completa para onde ele levaria.
 */
export function EstaSemanaSection({
  jobs,
  onOpen,
}: {
  jobs: Job[];
  onOpen: (job: Job) => void;
}) {
  return (
    <section className="flex flex-col" style={{ gap: "12px" }}>
      <div className="flex items-center justify-between">
        <h2 style={SECTION_TITLE_STYLE}>Esta semana</h2>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="disabled:opacity-50"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--accent-deep)",
            minHeight: "44px",
          }}
        >
          Ver tudo ›
        </button>
      </div>
      <div style={LIST_STYLE}>
        {jobs.length === 0 ? (
          <ListaVazia />
        ) : (
          jobs.map((job, i) => {
            const meta = STATUS_META[job.status];
            const Icon = STATUS_ICON[job.status];
            return (
              <Linha
                key={job.id}
                job={job}
                isLast={i === jobs.length - 1}
                onOpen={onOpen}
                detalhe={`${formatDiaCurto(job.data)} · ${formatHora(job.hora)} · ${meta.label}`}
                valor={formatBRL(job.valor)}
                marca={
                  <span
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: `rgb(${meta.rgb} / 0.14)`,
                      color: meta.color,
                    }}
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                }
              />
            );
          })
        )}
      </div>
    </section>
  );
}

/**
 * Seção "Próximas semanas" (J03): atendimentos depois desta semana, com
 * avatar de inicial, `dia · hora` e valor.
 */
export function ProximasSemanasSection({
  jobs,
  onOpen,
}: {
  jobs: Job[];
  onOpen: (job: Job) => void;
}) {
  return (
    <section className="flex flex-col" style={{ gap: "12px" }}>
      <h2 style={SECTION_TITLE_STYLE}>Próximas semanas</h2>
      <div style={LIST_STYLE}>
        {jobs.length === 0 ? (
          <ListaVazia />
        ) : (
          jobs.map((job, i) => (
            <Linha
              key={job.id}
              job={job}
              isLast={i === jobs.length - 1}
              onOpen={onOpen}
              detalhe={`${formatDiaCurto(job.data)} · ${formatHora(job.hora)}`}
              valor={formatBRL(job.valor)}
              marca={
                <span
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "var(--accent-tint)",
                    color: "var(--accent-deep)",
                    fontSize: "15px",
                    fontWeight: 800,
                  }}
                >
                  {inicialDoNome(job.clienteNome)}
                </span>
              }
            />
          ))
        )}
      </div>
    </section>
  );
}
