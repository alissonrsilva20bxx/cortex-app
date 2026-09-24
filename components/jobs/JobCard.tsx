"use client";

import { ChevronRight, MapPin, Video } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatBRL } from "@/lib/finance";
import type { Job } from "@/lib/types";

/**
 * Cartão da timeline (issue #135) — composição de `/dev-preview/ios`
 * (`.timelineCard`/`.timelineTitle`/`.timelineDetails`): nome + selo de
 * status + seta na linha de cima, local/modalidade + valor na linha de
 * baixo. `job.hora` saiu daqui: a timeline (JobsTab.tsx) agora mostra a
 * hora fora do cartão, na própria linha do horário (`.timelineTime`) —
 * duplicar a hora dentro do cartão também seria redundante com isso.
 *
 * Cor do selo de status via `StatusBadge`/`STATUS_META` — tokens
 * semânticos (`var(--info)`/`var(--success)`/`var(--accent)`/
 * `var(--danger)`), não as cores hardcoded que o laboratório usa pros
 * dois selos ad hoc "Concluído"/"Hoje" (que também não cobrem os 4
 * valores reais do enum `agendado|confirmado|concluído|cancelado`).
 */
export function JobCard({
  job,
  onClick,
}: {
  job: Job;
  onClick: (job: Job) => void;
}) {
  return (
    <button
      onClick={() => onClick(job)}
      className="w-full text-left transition-all active:opacity-70"
      style={{ minHeight: "44px" }}
    >
      <div className="flex items-center gap-2">
        <p
          className="font-semibold truncate flex-1 min-w-0"
          style={{
            fontSize: "14px",
            letterSpacing: "-0.02em",
            color: "var(--text)",
          }}
        >
          {job.clienteNome}
        </p>
        <StatusBadge status={job.status} />
        <ChevronRight
          size={15}
          className="shrink-0"
          style={{ color: "var(--text-muted)" }}
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span
          className="flex items-center gap-1.5 min-w-0"
          style={{ fontSize: "12px", color: "var(--text-muted)" }}
        >
          {job.modalidade === "online" ? (
            <Video size={12} className="shrink-0" />
          ) : (
            <MapPin size={12} className="shrink-0" />
          )}
          <span className="truncate">
            {job.modalidade === "online"
              ? "Online"
              : (job.local ?? "Presencial")}
          </span>
        </span>
        <strong
          className="font-bold tabular-nums shrink-0"
          style={{ fontSize: "13px", color: "var(--accent)" }}
        >
          {formatBRL(job.valor, 2)}
        </strong>
      </div>
    </button>
  );
}
