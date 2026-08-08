"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Video, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
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

const formatTime = (hora: string) => {
  const [h, m] = hora.split(":");
  return `${h}h${m}`;
};

/** Dia/mês curto pro selo de data — "21" + "AGO", como no laboratório. */
export function formatDayBadge(data: string): { day: string; month: string } {
  const d = new Date(data + "T00:00:00");
  return {
    day: String(d.getDate()),
    month: d
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "")
      .toUpperCase(),
  };
}

/**
 * Superfície sólida (sem blur), como no laboratório visual — mesmo
 * tratamento de HeroCard/ObjetivosCard, nomeado aqui (em vez de inline)
 * pra ficar consistente com os outros dois arquivos deste ticket.
 * `border` sobrescreve a borda cor-de-destaque de `.glass-card` por uma
 * neutra (mais perto do laboratório); o "shine" de `.glass-card::before`
 * não é alcançável por inline style — resíduo aceito, ver HeroCard.tsx.
 */
const SOLID_SURFACE_STYLE = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
  border: "1px solid var(--border-color)",
} as const;

export function NextJobCard({ jobs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const job = getProximoJob(jobs);
  const dayBadge = job ? formatDayBadge(job.data) : null;

  return (
    <GlassCard
      className="p-5 duration-300"
      onClick={job ? () => setExpanded((v) => !v) : undefined}
      radius="md"
      style={{
        ...SOLID_SURFACE_STYLE,
        boxShadow: expanded
          ? "inset 0 1px 0 rgb(255 255 255 / 0.035), 0 2px 1px rgb(0 0 0 / 0.12), 0 12px 32px rgb(0 0 0 / 0.22), var(--glow-sm)"
          : "inset 0 1px 0 rgb(255 255 255 / 0.035), 0 10px 30px rgb(0 0 0 / 0.18)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p className="section-label">Próximo atendimento</p>
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
          Nenhum atendimento agendado ainda. Toque no + para registrar.
        </p>
      ) : (
        <>
          {/* Summary row — selo de dia/mês à esquerda, como no laboratório
              (troca o "12 jul" solto por um bloco de data compacto). */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="grid shrink-0 place-items-center"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  background: "var(--surface)",
                }}
              >
                <span
                  className="font-semibold leading-none"
                  style={{
                    fontSize: "18px",
                    letterSpacing: "-0.03em",
                    color: "var(--text)",
                  }}
                >
                  {dayBadge?.day}
                </span>
                <span
                  className="mt-0.5 font-semibold uppercase"
                  style={{ fontSize: "9px", color: "var(--text-muted)" }}
                >
                  {dayBadge?.month}
                </span>
              </div>

              <div className="min-w-0">
                <p
                  className="font-bold truncate"
                  style={{
                    fontSize: "15px",
                    letterSpacing: "-0.02em",
                    color: "var(--text)",
                  }}
                >
                  {job.clienteNome}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock size={11} style={{ color: "var(--text-muted)" }} />
                  <span
                    className="font-medium truncate"
                    style={{ fontSize: "12.5px", color: "var(--text-muted)" }}
                  >
                    {formatTime(job.hora)} ·{" "}
                    {job.modalidade === "online"
                      ? "Online"
                      : (job.local ?? "Presencial")}
                  </span>
                </div>
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
    </GlassCard>
  );
}
