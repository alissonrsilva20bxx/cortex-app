"use client";

import { useJornada } from "@/components/jornada/useJornada";
import { descansoDeHoje } from "@/components/jornada/progresso";
import {
  estadoDoDescanso,
  type EstadoDescanso,
} from "@/lib/atendimentos/status";
import { useAgora } from "@/lib/useAgora";
import type { Job } from "@/lib/types";

/**
 * O descanso de propósito da Jornada na Agenda: registra a ação `descanso`
 * (uma vez por dia) e diz em que estado o botão está hoje. É para onde o
 * "Próximo passo" da Jornada leva quando pede um descanso.
 */
export function useDescanso(userId: string, jobs: readonly Job[]) {
  const { estado, registrar } = useJornada(userId);
  const agora = useAgora();
  const situacao: EstadoDescanso = estadoDoDescanso(
    jobs,
    estado ? descansoDeHoje(estado) : false,
    agora
  );
  return {
    situacao,
    descansar: () => void registrar("descanso"),
  };
}
