"use client";

import { aguardandoResposta } from "@/lib/atendimentos/status";
import { useAgora } from "@/lib/useAgora";
import type { Job } from "@/lib/types";
import { ACONTECEU } from "@/components/jobs/textosAgenda";
import { useMudarStatus } from "@/components/jobs/useMudarStatus";
import { InicioCard } from "./InicioCard";
import { CARD_PEQUENO, IconeCard, ROTULO_CARD } from "./pecasMockup";
import { formatHora, rotuloDiaCurto } from "./inicioAgenda";

interface Props {
  userId: string;
  jobs: Job[];
  /** O status mudou: a página recarrega Agenda, Financeiro e Início. */
  aoMudar: () => void;
  /** Leva à Agenda, onde está a lista dos que esperam resposta. */
  aoVerAgenda: () => void;
}

/**
 * A pergunta "Aconteceu?" do Início, quando existe atendimento em aberto
 * cujo horário já passou: o mais recente, com "Sim, concluir" e "Não
 * aconteceu". Largura total, logo abaixo do cumprimento: no topo, os botões
 * ficam sempre acima da pílula "Faltam N dias de teste" na primeira vista.
 * Os outros pendentes aparecem como "+N esperando resposta", que leva à
 * Agenda. Atendimento que já passou não pode aparecer como o próximo. Sem
 * nenhum pendente, não renderiza nada (e o card Próximo volta).
 */
export function AconteceuCard({ userId, jobs, aoMudar, aoVerAgenda }: Props) {
  const { mudar, salvando, erro } = useMudarStatus(userId, aoMudar);
  // Relógio de 1 minuto: passou o horário, o card aparece sozinho.
  const agora = useAgora();
  const pendentes = aguardandoResposta(jobs, agora);
  const job = pendentes[0];
  if (!job) return null;

  return (
    <InicioCard
      style={{ ...CARD_PEQUENO, gap: "10px" }}
      ariaLabel={ACONTECEU.titulo}
    >
      <div className="flex items-center" style={{ gap: "8px" }}>
        <IconeCard>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17.5h.01" />
        </IconeCard>
        <span style={ROTULO_CARD}>{ACONTECEU.titulo}</span>
      </div>
      <span className="truncate" style={{ fontSize: "14px", fontWeight: 700 }}>
        {job.clienteNome.split(" ")[0]} ·{" "}
        {rotuloDiaCurto(job.data).toLowerCase()} · {formatHora(job.hora)}
      </span>
      <div className="flex" style={{ gap: "8px" }}>
        <button
          type="button"
          disabled={salvando}
          onClick={() => void mudar(job, "concluído")}
          className="flex-1 rounded-xl font-semibold active:opacity-80 disabled:opacity-60"
          style={{
            minHeight: "44px",
            fontSize: "13px",
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
          className="flex-1 rounded-xl font-semibold active:opacity-80 disabled:opacity-60"
          style={{
            minHeight: "44px",
            fontSize: "13px",
            background: "var(--surface-sub)",
            color: "var(--t-ink)",
            border: "1px solid var(--border-color)",
          }}
        >
          {ACONTECEU.nao}
        </button>
      </div>
      {pendentes.length > 1 && (
        <button
          type="button"
          onClick={aoVerAgenda}
          className="text-left font-semibold active:opacity-70"
          style={{ fontSize: "12px", color: "var(--t-mut)" }}
        >
          {ACONTECEU.outros(pendentes.length - 1)}
        </button>
      )}
      {erro && (
        <span role="alert" style={{ fontSize: "11px", color: "var(--danger)" }}>
          {erro}
        </span>
      )}
    </InicioCard>
  );
}
