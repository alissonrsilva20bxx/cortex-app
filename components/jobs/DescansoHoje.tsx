"use client";

import { useJornada } from "@/components/jornada/useJornada";
import { descansoDeHoje } from "@/components/jornada/progresso";
import { DESCANSO } from "./textosAgenda";

interface Props {
  userId: string;
}

/**
 * "Hoje é descanso": registra a ação `descanso` da Jornada (o dia de
 * descanso de propósito, uma vez por dia). É o botão para onde o "Próximo
 * passo" da Jornada leva quando pede um descanso. Depois de registrado,
 * fica desabilitado e diz o motivo, em vez de deixar tocar de novo.
 */
export function DescansoHoje({ userId }: Props) {
  const { estado, registrar } = useJornada(userId);
  if (!estado) return null;
  const feito = descansoDeHoje(estado);

  return (
    <button
      type="button"
      onClick={() => void registrar("descanso")}
      disabled={feito}
      title={feito ? DESCANSO.motivoDesabilitado : undefined}
      data-descanso-hoje
      className="flex items-center justify-center rounded-2xl font-semibold active:opacity-80"
      style={{
        minHeight: "44px",
        gap: "8px",
        fontSize: "13px",
        background: "var(--card-solid)",
        color: "var(--text)",
        opacity: feito ? 0.7 : 1,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ color: "var(--accent-deep)" }}
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      {feito ? DESCANSO.feito : DESCANSO.botao}
    </button>
  );
}
