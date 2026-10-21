"use client";

import { aguardandoResposta } from "@/lib/atendimentos/status";
import type { Job } from "@/lib/types";
import { ACONTECEU } from "@/components/jobs/textosAgenda";
import { useMudarStatus } from "@/components/jobs/useMudarStatus";
import { InicioCard } from "./InicioCard";
import { CARD_PEQUENO, IconeCard, ROTULO_CARD } from "./pecasMockup";
import { formatHora, rotuloDiaCurto } from "./inicioAgenda";

interface Props {
  jobs: Job[];
  /** O status mudou: a página recarrega Agenda, Financeiro e Início. */
  aoMudar: () => void;
}

/**
 * O lugar do "Próximo" quando existe atendimento em aberto cujo horário já
 * passou: pergunta "Aconteceu?" do mais recente, com "Sim, concluir" e "Não
 * aconteceu". Atendimento que já passou não pode aparecer como se fosse o
 * próximo. Sem nenhum pendente, não renderiza nada.
 */
export function AconteceuCard({ jobs, aoMudar }: Props) {
  const { mudar, salvando, erro } = useMudarStatus(aoMudar);
  const pendentes = aguardandoResposta(jobs);
  const job = pendentes[0];
  if (!job) return null;

  return (
    <InicioCard style={{ ...CARD_PEQUENO, minHeight: "118px" }}>
      <IconeCard>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17.5h.01" />
      </IconeCard>
      <span style={ROTULO_CARD}>{ACONTECEU.titulo}</span>
      <span className="truncate" style={{ fontSize: "12px" }}>
        {job.clienteNome.split(" ")[0]} ·{" "}
        {rotuloDiaCurto(job.data).toLowerCase()} · {formatHora(job.hora)}
      </span>
      <div className="flex flex-col" style={{ gap: "6px" }}>
        <button
          type="button"
          disabled={salvando}
          onClick={() => void mudar(job, "concluído")}
          className="rounded-xl font-semibold active:opacity-80 disabled:opacity-60"
          style={{
            minHeight: "40px",
            fontSize: "12px",
            background: "var(--accent)",
            color: "white",
          }}
        >
          {salvando ? ACONTECEU.salvando : ACONTECEU.sim}
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={() => void mudar(job, "cancelado")}
          className="rounded-xl font-semibold active:opacity-80 disabled:opacity-60"
          style={{
            minHeight: "40px",
            fontSize: "12px",
            background: "var(--surface-sub)",
            color: "var(--t-ink)",
            border: "1px solid var(--border-color)",
          }}
        >
          {ACONTECEU.nao}
        </button>
      </div>
      {pendentes.length > 1 && (
        <span style={{ fontSize: "11px", color: "var(--t-mut)" }}>
          {ACONTECEU.outros(pendentes.length - 1)}
        </span>
      )}
      {erro && (
        <span role="alert" style={{ fontSize: "11px", color: "var(--danger)" }}>
          {erro}
        </span>
      )}
    </InicioCard>
  );
}
