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
      className="glass-card rounded-[22px] p-5 transition-all duration-300"
      style={{
        cursor: job ? "pointer" : "default",
        boxShadow: expanded
          ? `inset 0 1px 0 rgb(255 255 255 / 0.07), 0 2px 1px rgb(0 0 0 / 0.12), 0 12px 40px rgb(0 0 0 / 0.28), var(--glow-sm), 0 0 0 0.5px rgb(var(--accent-rgb) / 0.06)`
          : undefined,
      }}
      onClick={() => job && setExpanded((v) => !v)}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p className="section-label">Próximo Job</p>
        {job && (
          <ChevronDown
            size={15}
            style={{
              color: "var(--text-muted)",
              transition: "transform 0.3s ease",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        )}
      </div>

      {!job ? (
        <p
          className="font-medium"
          style={{ fontSize: "14px", color: "var(--text-muted)" }}
        >
          Nenhum job agendado
        </p>
      ) : (
        <>
          {/* Summary row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="font-bold truncate"
                style={{
                  fontSize: "17px",
                  letterSpacing: "-0.025em",
                  color: "var(--text)",
                }}
              >
                {job.clienteNome}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Clock size={11} style={{ color: "var(--text-muted)" }} />
                <span
                  className="font-medium"
                  style={{ fontSize: "12.5px", color: "var(--text-muted)" }}
                >
                  {formatDate(job.data)} · {formatTime(job.hora)}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Countdown chip with glow */}
              <span
                className="font-bold px-3 py-1 rounded-full"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.01em",
                  background: "rgb(var(--accent-rgb) / 0.12)",
                  color: "var(--accent)",
                  boxShadow: "0 0 10px rgb(var(--accent-rgb) / 0.2)",
                  border: "1px solid rgb(var(--accent-rgb) / 0.2)",
                }}
              >
                {countdownLabel(getDaysUntil(job.data))}
              </span>
              <span
                className="font-extrabold"
                style={{
                  fontSize: "16px",
                  letterSpacing: "-0.02em",
                  color: "var(--accent)",
                }}
              >
                {formatBRL(job.valor)}
              </span>
            </div>
          </div>

          {/* Expanded details */}
          <div
            style={{
              maxHeight: expanded ? "200px" : "0px",
              overflow: "hidden",
              transition: "max-height 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div
              className="mt-4 pt-4 flex flex-col gap-3"
              style={{
                borderTop: "1px solid var(--divider, var(--border-color))",
              }}
            >
              <div className="flex items-center gap-2">
                {job.modalidade === "online" ? (
                  <Video size={13} style={{ color: "var(--accent)" }} />
                ) : (
                  <MapPin size={13} style={{ color: "var(--accent)" }} />
                )}
                <span
                  className="font-medium"
                  style={{
                    fontSize: "13px",
                    color: "var(--text-2, var(--text))",
                  }}
                >
                  {job.modalidade === "online"
                    ? "Atendimento online"
                    : (job.local ?? "Presencial")}
                </span>
              </div>

              <div>
                <span
                  className="font-semibold capitalize px-3 py-1 rounded-full"
                  style={{
                    fontSize: "11px",
                    background: "var(--surface-2, var(--surface))",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {job.status}
                </span>
              </div>

              {job.observacoes && (
                <p
                  className="font-medium leading-relaxed"
                  style={{ fontSize: "13px", color: "var(--text-muted)" }}
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
