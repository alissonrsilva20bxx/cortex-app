"use client";

import { ChevronRight, MapPin, Video } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatBRL } from "@/lib/finance";
import type { Job } from "@/lib/types";

interface Props {
  job: Job;
  onClick: (job: Job) => void;
}

/**
 * Linha de atendimento dentro do painel do dia — grid de 4 colunas
 * (hora / conteúdo / status / seta), como no laboratório (AgendaScreen,
 * LaunchScreens.tsx:147-178, `grid-cols-[48px_1fr_auto_12px]`). O
 * laboratório usa um "título de serviço" que não existe no tipo `Job`
 * real (sem campo de serviço/duração) — a coluna de conteúdo usa
 * `clienteNome` como linha principal (o dado real mais saliente, na
 * posição em que o mock mostra o título) e modalidade/local como
 * secundária (na posição em que o mock mostra a duração), preservando
 * `valor` (dado real que a versão anterior deste card já exibia) como
 * terceira linha em vez de inventar um campo que o banco não tem.
 *
 * Cor do selo de status via `StatusBadge`/`STATUS_META` — tokens
 * semânticos (`var(--info)`/`var(--success)`/`var(--accent)`/
 * `var(--danger)`), não as cores hardcoded (`emerald-400`/`amber-400`)
 * que o laboratório usa para "Confirmado"/"Pendente" (que também não
 * batem com o enum real `agendado|confirmado|concluído|cancelado`).
 */
export function JobCard({ job, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(job)}
      className="grid w-full grid-cols-[44px_1fr_auto_16px] items-start gap-2 px-3 py-3 text-left transition-all active:opacity-70"
      style={{ minHeight: "44px" }}
    >
      <span
        className="font-semibold tabular-nums"
        style={{ fontSize: "12px", color: "var(--text)" }}
      >
        {job.hora}
      </span>

      <div className="min-w-0">
        <p
          className="font-semibold truncate"
          style={{
            fontSize: "13px",
            letterSpacing: "-0.02em",
            color: "var(--text)",
          }}
        >
          {job.clienteNome}
        </p>
        <div className="flex items-center gap-1 mt-1">
          {job.modalidade === "online" ? (
            <Video size={10} style={{ color: "var(--text-muted)" }} />
          ) : (
            <MapPin size={10} style={{ color: "var(--text-muted)" }} />
          )}
          <span
            className="truncate"
            style={{ fontSize: "10px", color: "var(--text-muted)" }}
          >
            {job.modalidade === "online"
              ? "Online"
              : (job.local ?? "Presencial")}
          </span>
        </div>
        <p
          className="font-bold tabular-nums mt-1"
          style={{ fontSize: "11px", color: "var(--accent)" }}
        >
          {formatBRL(job.valor, 2)}
        </p>
      </div>

      <StatusBadge status={job.status} />

      <ChevronRight
        size={14}
        className="mt-1"
        style={{ color: "var(--text-muted)" }}
      />
    </button>
  );
}
