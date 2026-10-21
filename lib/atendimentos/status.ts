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

/** Instante (ms) em que o atendimento começa. */
function instanteDoAtendimento(job: Job): number {
  return new Date(`${job.data}T${job.hora}`).getTime();
}

/** O horário do atendimento já chegou (ou passou). */
export function horarioChegou(job: Job, agora: Date = new Date()): boolean {
  return instanteDoAtendimento(job) <= agora.getTime();
}

const EM_ABERTO: ReadonlySet<Job["status"]> = new Set([
  "agendado",
  "confirmado",
]);

/** Confirmar: a cliente confirmou, ANTES do horário. Só do agendado. */
export function podeConfirmar(job: Job, agora: Date = new Date()): boolean {
  return job.status === "agendado" && !horarioChegou(job, agora);
}

/** Concluir ou "Não aconteceu": só a partir do horário, de um atendimento em
 * aberto (agendado ou confirmado). Atendimento futuro não se conclui. */
export function podeConcluir(job: Job, agora: Date = new Date()): boolean {
  return EM_ABERTO.has(job.status) && horarioChegou(job, agora);
}

export type NovoStatus = "confirmado" | "concluído" | "cancelado";

export interface DepsMudarStatus {
  /** Grava o status no banco (update em `jobs`, pelo id). */
  atualizar: (
    id: string,
    status: NovoStatus
  ) => Promise<{ error: { message: string } | null }>;
}

export type ResultadoMudarStatus =
  | { ok: true }
  | {
      ok: false;
      motivo: "fora-do-fluxo" | "falha-ao-gravar";
      detalhe?: string;
    };

/**
 * Muda o status seguindo o fluxo do capitão. Recusa o que o fluxo não
 * permite (confirmar depois do horário, concluir ou cancelar antes dele).
 */
export async function mudarStatus(
  job: Job,
  novo: NovoStatus,
  deps: DepsMudarStatus,
  agora: Date = new Date()
): Promise<ResultadoMudarStatus> {
  const permitido =
    novo === "confirmado"
      ? podeConfirmar(job, agora)
      : podeConcluir(job, agora);
  if (!permitido) return { ok: false, motivo: "fora-do-fluxo" };

  const { error } = await deps.atualizar(job.id, novo);
  if (error) {
    return { ok: false, motivo: "falha-ao-gravar", detalhe: error.message };
  }
  return { ok: true };
}

/** Atendimentos em aberto (agendado ou confirmado) cujo horário já passou:
 * a Agenda e o Início perguntam "Aconteceu?". O mais recente primeiro. */
export function aguardandoResposta(
  jobs: readonly Job[],
  agora: Date = new Date()
): Job[] {
  return jobs
    .filter((j) => podeConcluir(j, agora))
    .sort((a, b) => instanteDoAtendimento(b) - instanteDoAtendimento(a));
}
