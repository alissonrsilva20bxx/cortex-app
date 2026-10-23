import {
  addDays,
  startOfWeek,
  toISODate,
} from "@/components/jobs/agendaSemana";
import { NOMES_DIAS } from "@/components/jobs/textosAgenda";
import { LOCALE } from "@/lib/jornada/textos";
import type { Job } from "@/lib/types";

/**
 * Como cada atendimento aparece na Semana viva. "aberto" é o de horário já
 * passado que segue agendado/confirmado: espera o "Aconteceu?", então não é
 * feito nem pela frente (a mesma regra de `resumoDaSemana`).
 */
export type MarcaDoAtendimento = "feito" | "frente" | "desmarcado" | "aberto";

export interface AtendimentoDoDia {
  id: string;
  hora: string;
  cliente: string;
  marca: MarcaDoAtendimento;
}

export interface DiaDaSemanaViva {
  iso: string;
  /** "Dom", "Seg"... */
  rotulo: string;
  /** "Domingo", "Segunda"... */
  nome: string;
  numero: number;
  hoje: boolean;
  passado: boolean;
  atendimentos: AtendimentoDoDia[];
}

export interface SemanaViva {
  dias: DiaDaSemanaViva[];
  /** "18 a 24 out" / "28 set a 4 out". */
  periodo: string;
}

function mesCurto(d: Date): string {
  return d.toLocaleDateString(LOCALE, { month: "short" }).replace(".", "");
}

function marcaDe(job: Job, agora: Date): MarcaDoAtendimento {
  if (job.status === "concluído") return "feito";
  if (job.status === "cancelado") return "desmarcado";
  return new Date(`${job.data}T${job.hora}`).getTime() >= agora.getTime()
    ? "frente"
    : "aberto";
}

/**
 * Os 7 dias da semana de `agora` (domingo a sábado, a mesma de
 * `resumoDaSemana`), cada um com seus atendimentos em ordem de horário. Só
 * organiza o que a tela desenha; os números e a frase seguem em
 * `resumoDaSemana`.
 */
export function semanaViva(jobs: readonly Job[], agora: Date): SemanaViva {
  const inicio = startOfWeek(agora);
  const hoje = toISODate(agora);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(inicio, i);
    const iso = toISODate(d);
    const nome = NOMES_DIAS[d.getDay()];
    return {
      iso,
      rotulo: nome.slice(0, 3),
      nome,
      numero: d.getDate(),
      hoje: iso === hoje,
      passado: iso < hoje,
      atendimentos: jobs
        .filter((j) => j.data === iso)
        .sort((a, b) => a.hora.localeCompare(b.hora))
        .map((j) => ({
          id: j.id,
          hora: j.hora,
          cliente: j.clienteNome,
          marca: marcaDe(j, agora),
        })),
    };
  });
  const fim = addDays(inicio, 6);
  const periodo =
    inicio.getMonth() === fim.getMonth()
      ? `${inicio.getDate()} a ${fim.getDate()} ${mesCurto(fim)}`
      : `${inicio.getDate()} ${mesCurto(inicio)} a ${fim.getDate()} ${mesCurto(fim)}`;
  return { dias, periodo };
}
