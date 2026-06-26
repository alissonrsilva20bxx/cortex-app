"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Video, Clock } from "lucide-react";
import type { Job } from "@/lib/types";

interface Props {
  jobs: Job[];
}

function getProximoJob(jobs: Job[]): Job | null {
  const now = new Date();
  const upcoming = jobs
    .filter((j) => j.status === "agendado" || j.status === "confirmado")
    .filter((j) => new Date(`${j.data}T${j.hora}`) >= now)
    .sort(
      (a, b) =>
        new Date(`${a.data}T${a.hora}`).getTime() -
        new Date(`${b.data}T${b.hora}`).getTime()
    );
  return upcoming[0] ?? null;
}

function getDaysUntil(data: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(data + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function countdownLabel(days: number): string {
  if (days < 0) return "Atrasado";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `em ${days} dias`;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v
  );

const formatDate = (data: string) =>
  new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });

const formatTime = (hora: string) => {
  const [h, m] = hora.split(":");
  return `${h}h${m}`;
};

export function NextJobCard({ jobs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const job = getProximoJob(jobs);

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-300"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-color)",
        transform: expanded ? "scale(1.012)" : "scale(1)",
        boxShadow: expanded ? "var(--glow)" : "none",
        cursor: job ? "pointer" : "default",
      }}
      onClick={() => job && setExpanded((v) => !v)}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Próximo Job
        </p>
        {job && (
          <ChevronDown
            size={16}
            style={{
              color: "var(--text-muted)",
              transition: "transform 0.3s ease",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        )}
      </div>

      {!job ? (
        <p className="text-sm py-1" style={{ color: "var(--text-muted)" }}>
          Nenhum job agendado
        </p>
      ) : (
        <>
          {/* Summary row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="font-semibold text-base truncate"
                style={{ color: "var(--text)" }}
              >
                {job.clienteNome}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock size={12} style={{ color: "var(--text-muted)" }} />
                <span
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatDate(job.data)} · {formatTime(job.hora)}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                style={{
                  background: "rgb(var(--accent-rgb) / 0.14)",
                  color: "var(--accent)",
                }}
              >
                {countdownLabel(getDaysUntil(job.data))}
              </span>
              <span
                className="font-bold text-sm"
                style={{ color: "var(--accent)" }}
              >
                {formatBRL(job.valor)}
              </span>
            </div>
          </div>

          {/* Expanded details */}
          <div
            style={{
              maxHeight: expanded ? "280px" : "0px",
              overflow: "hidden",
              transition: "max-height 0.35s ease",
            }}
          >
            <div
              className="mt-4 pt-4 flex flex-col gap-3"
              style={{ borderTop: "1px solid var(--border-color)" }}
            >
              {/* Modalidade / local */}
              <div className="flex items-center gap-2">
                {job.modalidade === "online" ? (
                  <Video size={14} style={{ color: "var(--accent)" }} />
                ) : (
                  <MapPin size={14} style={{ color: "var(--accent)" }} />
                )}
                <span className="text-sm" style={{ color: "var(--text)" }}>
                  {job.modalidade === "online"
                    ? "Atendimento online"
                    : (job.local ?? "Presencial")}
                </span>
              </div>

              {/* Status badge */}
              <div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full capitalize"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {job.status}
                </span>
              </div>

              {/* Observações */}
              {job.observacoes && (
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {job.observacoes}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
