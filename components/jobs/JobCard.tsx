"use client";

import { MapPin, Video, Clock } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { STATUS_META } from "./status";
import { formatBRL } from "@/lib/finance";
import type { Job } from "@/lib/types";

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
      className="glass-card w-full text-left rounded-2xl p-4 transition-all active:opacity-70 active:scale-[0.99]"
      onClick={() => onClick(job)}
      style={{ borderLeft: `3px solid ${STATUS_META[job.status].color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + time + location */}
        <div className="min-w-0 flex-1">
          <p
            className="font-bold text-[16px] truncate"
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
            className="font-extrabold text-[17px] tabular-nums"
            style={{
              color: "var(--accent)",
              textShadow: "0 0 18px rgb(var(--accent-rgb) / 0.55)",
            }}
          >
            {formatBRL(job.valor, 2)}
          </span>
          <StatusBadge status={job.status} />
        </div>
      </div>
    </button>
  );
}
