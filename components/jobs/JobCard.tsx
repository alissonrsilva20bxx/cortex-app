"use client";

import { MapPin, Video, Clock } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { Job } from "@/lib/types";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

const formatDate = (data: string) =>
  new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

interface Props {
  job: Job;
  onClick: (job: Job) => void;
}

export function JobCard({ job, onClick }: Props) {
  return (
    <button
      className="glass-card w-full text-left rounded-2xl p-4 transition-opacity active:opacity-70"
      onClick={() => onClick(job)}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + time + location */}
        <div className="min-w-0 flex-1">
          <p
            className="font-semibold text-[15px] truncate"
            style={{ color: "var(--text)" }}
          >
            {job.clienteNome}
          </p>

          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock size={11} style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatDate(job.data)} · {job.hora}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            {job.modalidade === "online" ? (
              <Video size={11} style={{ color: "var(--text-muted)" }} />
            ) : (
              <MapPin size={11} style={{ color: "var(--text-muted)" }} />
            )}
            <span
              className="text-xs truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {job.modalidade === "online"
                ? "Online"
                : (job.local ?? "Presencial")}
            </span>
          </div>
        </div>

        {/* Right: valor + status */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className="font-bold text-base"
            style={{ color: "var(--accent)" }}
          >
            {formatBRL(job.valor)}
          </span>
          <StatusBadge status={job.status} />
        </div>
      </div>
    </button>
  );
}
