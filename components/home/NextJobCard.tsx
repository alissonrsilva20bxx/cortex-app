"use client";

import type { Job } from "@/lib/types";
import { InicioCard } from "./InicioCard";
import {
  CARD_PEQUENO,
  IconeCard,
  ROTULO_CARD,
  VALOR_CARD,
} from "./pecasMockup";
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
    <InicioCard style={{ ...CARD_PEQUENO, minHeight: "118px" }}>
      <IconeCard>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </IconeCard>
      <span style={ROTULO_CARD}>Próximo</span>
      {job ? (
        <>
          <span style={VALOR_CARD}>{formatHora(job.hora)}</span>
          {/* Mockup: só o primeiro nome ("<nome> · sex 25"). */}
          <span className="truncate" style={{ fontSize: "12px" }}>
            {job.clienteNome.split(" ")[0]} ·{" "}
            {rotuloDiaCurto(job.data).toLowerCase()}
          </span>
        </>
      ) : (
        <span style={{ fontSize: "12px", color: "var(--t-mut)" }}>
          Nenhum atendimento agendado ainda.
        </span>
      )}
    </InicioCard>
  );
}
