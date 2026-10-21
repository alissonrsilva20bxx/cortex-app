"use client";

import { useState } from "react";
import {
  aguardandoResposta,
  LIMITE_ACONTECEU_AGENDA,
  pendentesVisiveis,
} from "@/lib/atendimentos/status";
import { useAgora } from "@/lib/useAgora";
import { formatMoeda } from "@/lib/finance";
import type { Job } from "@/lib/types";
import { formatDiaCurto, formatHora } from "./agendaSemana";
import { ACONTECEU } from "./textosAgenda";
import { useMudarStatus } from "./useMudarStatus";

interface Props {
  userId: string;
  jobs: readonly Job[];
  /** Abre o detalhe do atendimento. */
  onOpen: (job: Job) => void;
  /** O status mudou: a página recarrega Agenda, Financeiro e Início. */
  onStatusMudou: () => void;
}

/**
 * "Aconteceu?" da Agenda: cada atendimento agendado ou confirmado cujo
 * horário já passou, com "Sim, concluir" (vira concluído) e "Não aconteceu"
 * (vira cancelado). Mostra os 3 mais recentes; havendo mais, "Ver todos (N)"
 * abre a lista completa, com os mesmos botões. Sem nenhum, não aparece. Sem isto o atendimento ficava
 * "agendado" para sempre e o dinheiro nunca entrava.
 */
export function AgendaAconteceu({
  userId,
  jobs,
  onOpen,
  onStatusMudou,
}: Props) {
  const { mudar, salvando, erro } = useMudarStatus(userId, onStatusMudou);
  const agora = useAgora();
  const [verTodos, setVerTodos] = useState(false);
  const pendentes = aguardandoResposta(jobs, agora);
  if (pendentes.length === 0) return null;
  const visiveis = pendentesVisiveis(pendentes, verTodos);

  return (
    <section
      aria-label={ACONTECEU.titulo}
      className="flex flex-col"
      style={{
        background: "var(--card-solid)",
        borderRadius: "20px",
        padding: "16px",
        gap: "12px",
      }}
    >
      <h2 style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)" }}>
        {ACONTECEU.titulo}
      </h2>
      {visiveis.map((job) => (
        <div key={job.id} className="flex flex-col" style={{ gap: "8px" }}>
          <button
            type="button"
            onClick={() => onOpen(job)}
            className="flex items-center justify-between gap-3 text-left active:opacity-70"
          >
            <span className="min-w-0">
              <span
                className="block truncate"
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {job.clienteNome}
              </span>
              <span
                className="block truncate"
                style={{ fontSize: "11px", color: "var(--text-muted)" }}
              >
                {formatDiaCurto(job.data)} · {formatHora(job.hora)}
              </span>
            </span>
            <strong
              className="shrink-0"
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: "var(--text)",
              }}
            >
              {formatMoeda(job.valor)}
            </strong>
          </button>
          <div className="flex" style={{ gap: "8px" }}>
            <button
              type="button"
              disabled={salvando}
              onClick={() => void mudar(job, "concluído")}
              className="flex-1 rounded-2xl font-semibold active:opacity-80 disabled:opacity-60"
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
              className="flex-1 rounded-2xl font-semibold active:opacity-80 disabled:opacity-60"
              style={{
                minHeight: "44px",
                fontSize: "13px",
                background: "var(--surface-sub)",
                color: "var(--text)",
                border: "1px solid var(--border-color)",
              }}
            >
              {ACONTECEU.nao}
            </button>
          </div>
        </div>
      ))}
      {pendentes.length > visiveis.length && (
        <button
          type="button"
          onClick={() => setVerTodos(true)}
          className="font-semibold active:opacity-70"
          style={{ fontSize: "13px", color: "var(--accent-deep)" }}
        >
          {ACONTECEU.verTodos(pendentes.length)}
        </button>
      )}
      {verTodos && pendentes.length > LIMITE_ACONTECEU_AGENDA && (
        <button
          type="button"
          onClick={() => setVerTodos(false)}
          className="font-semibold active:opacity-70"
          style={{ fontSize: "13px", color: "var(--accent-deep)" }}
        >
          {ACONTECEU.verMenos}
        </button>
      )}
      {erro && (
        <p
          role="alert"
          className="text-sm font-semibold text-center"
          style={{ color: "var(--danger)" }}
        >
          {erro}
        </p>
      )}
    </section>
  );
}
