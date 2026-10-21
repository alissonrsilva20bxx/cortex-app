import type { Job, JobStatus } from "@/lib/types";

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
function instanteDoAtendimento(job: Pick<Job, "data" | "hora">): number {
  return new Date(`${job.data}T${job.hora}`).getTime();
}

/** O horário do atendimento já chegou (ou passou). */
export function horarioChegou(
  job: Pick<Job, "data" | "hora">,
  agora: Date = new Date()
): boolean {
  return instanteDoAtendimento(job) <= agora.getTime();
}

const EM_ABERTO: ReadonlySet<Job["status"]> = new Set([
  "agendado",
  "confirmado",
]);

/** Confirmar: a cliente confirmou, ANTES do horário. Só do agendado. */
export function podeConfirmar(
  job: Pick<Job, "status" | "data" | "hora">,
  agora: Date = new Date()
): boolean {
  return job.status === "agendado" && !horarioChegou(job, agora);
}

/** Concluir ou "Não aconteceu": só a partir do horário, de um atendimento em
 * aberto (agendado ou confirmado). Atendimento futuro não se conclui. */
export function podeConcluir(
  job: Pick<Job, "status" | "data" | "hora">,
  agora: Date = new Date()
): boolean {
  return EM_ABERTO.has(job.status) && horarioChegou(job, agora);
}

type EstadoGravado = Pick<Job, "status" | "data" | "hora">;

/** Os status que o formulário pode gravar para a data e a hora escolhidas,
 * pelas mesmas regras do detalhe (`podeConfirmar` / `podeConcluir`):
 * Agendado sempre; Confirmado só antes do horário; Concluído e Não aconteceu
 * (cancelado) só a partir dele. `gravado` é o atendimento como já está salvo
 * (`null` se é novo): o status que ele já tem, com a mesma data e hora,
 * continua valendo, para editar outro campo sem esbarrar nele. */
export function statusPermitidos(
  data: string,
  hora: string,
  gravado: EstadoGravado | null,
  agora: Date = new Date()
): JobStatus[] {
  const aberto = { status: "agendado" as const, data, hora };
  const permitidos: JobStatus[] = ["agendado"];
  if (podeConfirmar(aberto, agora)) permitidos.push("confirmado");
  if (podeConcluir(aberto, agora)) permitidos.push("concluído", "cancelado");
  if (
    gravado &&
    gravado.data === data &&
    gravado.hora === hora &&
    !permitidos.includes(gravado.status)
  ) {
    permitidos.push(gravado.status);
  }
  return permitidos;
}

/** O status escolhido no formulário, ou "agendado" se a data/hora escolhidas
 * não o permitem mais. */
export function statusAposMudarHorario(
  status: JobStatus,
  data: string,
  hora: string,
  gravado: EstadoGravado | null,
  agora: Date = new Date()
): JobStatus {
  return statusPermitidos(data, hora, gravado, agora).includes(status)
    ? status
    : "agendado";
}

/** O atendimento vira concluído agora (e não era antes): é aí que o dia
 * conta na Jornada, não ao criar. `antes` é `null` para atendimento novo.
 * Quem já estava concluído e só foi editado não conta de novo. */
export function contaComoDiaAtivo(
  antes: Job["status"] | null,
  depois: Job["status"]
): boolean {
  return depois === "concluído" && antes !== "concluído";
}

export type NovoStatus = "confirmado" | "concluído" | "cancelado";

export interface DepsMudarStatus {
  /** Grava o status no banco (update em `jobs`, pelo id). */
  atualizar: (
    id: string,
    status: NovoStatus
  ) => Promise<{ error: { message: string } | null }>;
  /** Registra a ação na Jornada (o "dia contado"). */
  registrar: (acao: "atendimento") => unknown;
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
 * Concluir, depois de gravar, conta o dia na Jornada.
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
  if (contaComoDiaAtivo(job.status, novo)) deps.registrar("atendimento");
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

/** "YYYY-MM-DD" no fuso local. */
function diaLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** Criar um atendimento para um dia DEPOIS de hoje é planejar: a Jornada
 * conta "Amanhã está planejado". Editar atendimento e criar para hoje (ou
 * para o passado) não planejam nada. */
export function contaComoPlanejar(
  jaExistia: boolean,
  data: string,
  hoje: Date = new Date()
): boolean {
  return !jaExistia && data > diaLocal(hoje);
}
