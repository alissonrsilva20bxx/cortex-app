"use client";

import type { Job } from "@/lib/types";
import { InicioCard } from "./InicioCard";
import {
  CARD_PEQUENO,
  IconeCard,
  ROTULO_CARD,
  VALOR_CARD,
} from "./pecasMockup";
import { aguardandoResposta } from "@/lib/atendimentos/status";
import { useAgora } from "@/lib/useAgora";
import { AconteceuCard } from "./AconteceuCard";
import { formatHora, proximoAtendimento, rotuloDiaCurto } from "./inicioAgenda";

// Reexportado só pra não quebrar quem já importa daqui
// (components/jobs/JobDetailSheet.tsx, Agenda) -- a Início não usa mais.
export { formatDayBadge } from "@/lib/proximoAtendimento";

interface Props {
  userId: string;
  jobs: Job[];
  /** O status de um atendimento mudou (pergunta "Aconteceu?"): a página
   * recarrega Agenda, Financeiro e Início. */
  aoMudar: () => void;
  /** Leva à Agenda (o "+N esperando resposta" do Aconteceu?). */
  aoVerAgenda: () => void;
}

/**
 * Card "Próximo" da grade da Início (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`): o horário em destaque e
 * "<nome> · <dia curto>". O detalhe (local, modalidade) passou pra lista
 * "Esta semana" logo abaixo, então o card não expande mais.
 *
 * Se existe atendimento em aberto cujo horário já passou, o card vira a
 * pergunta "Aconteceu?" (AconteceuCard) em vez de mostrar o passado como
 * se fosse o próximo.
 */
export function NextJobCard({ userId, jobs, aoMudar, aoVerAgenda }: Props) {
  // Relógio de 1 minuto: passou o horário, o card vira "Aconteceu?" sozinho.
  const agora = useAgora();
  if (aguardandoResposta(jobs, agora).length > 0) {
    return (
      <AconteceuCard
        userId={userId}
        jobs={jobs}
        agora={agora}
        aoMudar={aoMudar}
        aoVerAgenda={aoVerAgenda}
      />
    );
  }
  const job = proximoAtendimento(jobs, agora);

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
