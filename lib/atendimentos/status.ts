import type { Job } from "@/lib/types";

/**
 * Regras puras do status do atendimento (Agenda e Início).
 *
 * Fluxo decidido pelo capitão (21/10/2026): Agendado -> Confirmado (opcional,
 * a cliente confirmou, ANTES do horário) -> no horário ou depois: Concluído
 * ou Não aconteceu (= cancelado). Fica em `.ts` para ter teste de verdade.
 */

/** A soma do dia: o que ainda vale (agendado, confirmado e concluído).
 * Cancelado não aconteceu e não entra. É previsão, não ganho: o ganho é só
 * o concluído e vive no Financeiro. */
export function totalPrevistoDoDia(jobs: readonly Job[]): number {
  return jobs
    .filter((j) => j.status !== "cancelado")
    .reduce((soma, j) => soma + j.valor, 0);
}
