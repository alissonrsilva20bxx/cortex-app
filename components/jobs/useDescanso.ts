"use client";

import { useJornada } from "@/components/jornada/useJornada";
import { descansoNoDia } from "@/components/jornada/progresso";
import {
  estadoDoDescanso,
  type EstadoDescanso,
} from "@/lib/atendimentos/status";
import { diaDoRelogio } from "@/lib/relogio";
import { useAgora } from "@/lib/useAgora";
import type { Job } from "@/lib/types";

/**
 * O descanso de propósito da Jornada na Agenda, para o DIA SELECIONADO
 * (`dia`, "AAAA-MM-DD"): diz em que estado o botão está e alterna. Tocar
 * marca o dia; tocar num dia já marcado desfaz. Os dias ficam no aparelho
 * e só o de hoje conta na Jornada, uma vez (ver `marcarDescanso` em
 * `lib/jornada/cliente.ts`). É para onde o "Próximo passo" da Jornada leva
 * quando pede um descanso.
 */
export function useDescanso(userId: string, jobs: readonly Job[], dia: string) {
  const { estado, descansos, marcarDescanso } = useJornada(userId);
  const hoje = diaDoRelogio(useAgora());
  const marcado = descansoNoDia(estado, descansos, dia);
  const situacao: EstadoDescanso = estadoDoDescanso(jobs, marcado, dia, hoje);
  return {
    situacao,
    alternar: () => marcarDescanso(dia, !marcado),
  };
}
