import {
  addDays,
  startOfWeek,
  toISODate,
} from "@/components/jobs/agendaSemana";
import {
  NOMES_DIAS,
  RESUMO_SEMANA,
  atendimentosPorExtenso,
  fraseDiasLivres,
} from "@/components/jobs/textosAgenda";
import type { Job } from "@/lib/types";

export interface DiaLivre {
  iso: string;
  nome: string;
  /** De hoje em diante: só estes entram na frase. */
  futuro: boolean;
}

export interface ResumoSemana {
  /** Concluídos na semana. */
  feitos: number;
  /** Agendados ou confirmados que ainda vão acontecer, de agora ao fim da semana. */
  pelaFrente: number;
  /** Cancelados na semana ("Cliente desmarcou" e "Não aconteceu"). */
  desmarcados: number;
  /** Dias da semana sem atendimento ativo (inclui dias passados e de descanso). */
  diasLivres: DiaLivre[];
  frase: string;
}

/** Máximo de dias livres nomeados na frase. */
const MAX_DIAS_NA_FRASE = 2;

/**
 * Resumo do tempo da semana real de `agora`, na mesma semana da Agenda
 * (domingo a sábado, `startOfWeek`). Sem dinheiro. Atendimento de hoje cujo
 * horário já passou e segue em aberto não é feito nem "pela frente": espera o
 * "Aconteceu?". Mas ele ocupa o dia, que não é livre. Descanso não é
 * atendimento, então o dia de descanso é livre.
 */
export function resumoDaSemana(
  jobs: readonly Job[],
  agora: Date
): ResumoSemana {
  const inicio = startOfWeek(agora);
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  const primeiro = toISODate(dias[0]);
  const ultimo = toISODate(dias[6]);
  const hoje = toISODate(agora);
  const daSemana = jobs.filter((j) => j.data >= primeiro && j.data <= ultimo);

  const feitos = daSemana.filter((j) => j.status === "concluído").length;
  const desmarcados = daSemana.filter((j) => j.status === "cancelado").length;
  const pelaFrente = daSemana.filter(
    (j) =>
      (j.status === "agendado" || j.status === "confirmado") &&
      new Date(`${j.data}T${j.hora}`).getTime() >= agora.getTime()
  ).length;

  const diasOcupados = new Set(
    daSemana.filter((j) => j.status !== "cancelado").map((j) => j.data)
  );
  const diasLivres: DiaLivre[] = dias
    .map((d) => ({
      iso: toISODate(d),
      nome: NOMES_DIAS[d.getDay()],
      futuro: toISODate(d) >= hoje,
    }))
    .filter((d) => !diasOcupados.has(d.iso));

  return {
    feitos,
    pelaFrente,
    desmarcados,
    diasLivres,
    frase: montarFrase(feitos, pelaFrente, diasLivres, diasOcupados.size),
  };
}

function montarFrase(
  feitos: number,
  pelaFrente: number,
  diasLivres: readonly DiaLivre[],
  diasOcupados: number
): string {
  if (diasOcupados === 0 && feitos === 0 && pelaFrente === 0) {
    return RESUMO_SEMANA.semanaLivre;
  }
  const partes: string[] = [];
  if (feitos > 0 && pelaFrente > 0) {
    partes.push(
      `Você fez ${atendimentosPorExtenso(feitos)} e tem ${pelaFrente} pela frente.`
    );
  } else if (feitos > 0) {
    partes.push(
      `Você fez ${atendimentosPorExtenso(feitos)}. ${RESUMO_SEMANA.nadaMaisMarcado}`
    );
  } else if (pelaFrente > 0) {
    partes.push(`Você tem ${atendimentosPorExtenso(pelaFrente)} pela frente.`);
  } else {
    partes.push(RESUMO_SEMANA.nadaMaisMarcado);
  }
  const livres = fraseDiasLivres(
    diasLivres
      .filter((d) => d.futuro)
      .slice(0, MAX_DIAS_NA_FRASE)
      .map((d) => d.nome)
  );
  if (livres) partes.push(livres);
  return partes.join(" ");
}
