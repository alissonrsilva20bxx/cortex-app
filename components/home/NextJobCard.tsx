"use client";

import { Clock } from "lucide-react";
import type { Job } from "@/lib/types";
import { InicioCard } from "./InicioCard";
import { formatHora, proximoAtendimento, rotuloDiaCurto } from "./inicioAgenda";

// Reexportado só pra não quebrar quem já importa daqui
// (components/jobs/JobDetailSheet.tsx, Agenda) -- a Início não usa mais.
export { formatDayBadge } from "@/lib/proximoAtendimento";

interface Props {
  jobs: Job[];
}

/**
 * Card "Próximo" da grade da Início (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`): o horário em destaque e
 * "<nome> · <dia curto>". O detalhe (local, modalidade) passou pra lista
 * "Esta semana" logo abaixo, então o card não expande mais.
 */
export function NextJobCard({ jobs }: Props) {
  const job = proximoAtendimento(jobs);

  return (
    <InicioCard
      className="flex flex-col gap-2"
      style={{ padding: "16px", minHeight: "118px" }}
    >
      <Clock size={20} style={{ color: "var(--accent-deep)" }} aria-hidden />
      <span
        className="font-semibold"
        style={{ fontSize: "11px", color: "var(--text-muted)" }}
      >
        Próximo
      </span>
      {job ? (
        <>
          <span
            className="font-extrabold tabular-nums leading-none"
            style={{ fontSize: "20px" }}
          >
            {formatHora(job.hora)}
          </span>
          <span className="truncate" style={{ fontSize: "12px" }}>
            {job.clienteNome} · {rotuloDiaCurto(job.data).toLowerCase()}
          </span>
        </>
      ) : (
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Nenhum atendimento agendado ainda.
        </span>
      )}
    </InicioCard>
  );
}
