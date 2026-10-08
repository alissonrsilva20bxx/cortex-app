import type { Job } from "@/lib/types";

/**
 * Lógica pura da Agenda (J03, Jornada): tira da semana, próximo
 * atendimento e as listas "Esta semana" / "Próximas semanas".
 *
 * Fica fora do `.tsx` pra ter teste de verdade: o Vitest deste projeto
 * roda em ambiente `node`, sem plugin de JSX, então só lógica em `.ts`
 * pode ser importada e executada num teste (mesmo motivo de
 * `lib/proximoAtendimento.ts`). Todas as funções que dependem de "hoje"
 * recebem a data de referência como parâmetro, pra o teste fixar a
 * semana (semana vazia, virada de mês) sem depender do relógio.
 */

/** D S T Q Q S S — domingo a sábado, como o mockup aprovado. */
export const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Domingo 00:00 (fuso local) da semana de `d`. */
export function startOfWeek(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/** "15h30" — mesma convenção já usada em NextJobCard/lib/notificacoes.ts. */
export function formatHora(hora: string): string {
  const [h, m] = hora.split(":");
  return `${h}h${m}`;
}

function parseLocalDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function jobInstant(job: Job): number {
  return new Date(`${job.data}T${job.hora}`).getTime();
}

function byDataHora(a: Job, b: Job): number {
  return a.data === b.data
    ? a.hora.localeCompare(b.hora)
    : a.data.localeCompare(b.data);
}

export interface WeekStripDay {
  iso: string;
  letter: string;
  day: number;
  hasJobs: boolean;
}

/**
 * As 7 colunas da tira da semana a partir de `weekStart` (um domingo),
 * com a data real de cada coluna (inclusive quando a semana atravessa a
 * virada do mês ou do ano). Uma semana sem nenhum atendimento devolve os
 * 7 dias com `hasJobs: false`, nunca uma lista vazia. A marca de "hoje"
 * é calculada em `JobsTab`, separada desta, pra hoje e dia com
 * atendimento nunca se confundirem.
 */
export function buildWeekStrip(
  weekStart: Date,
  jobs: readonly Job[]
): WeekStripDay[] {
  const datesWithJobs = new Set(jobs.map((j) => j.data));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const iso = toISODate(d);
    return {
      iso,
      letter: WEEKDAY_LETTERS[d.getDay()],
      day: d.getDate(),
      hasJobs: datesWithJobs.has(iso),
    };
  });
}

/**
 * Próximo atendimento real: agendado ou confirmado, a partir de agora,
 * o mais cedo primeiro. Mesmo critério de `NextJobCard` (Início), pra as
 * duas telas nunca apontarem atendimentos diferentes.
 */
export function proximoAtendimento(
  jobs: readonly Job[],
  now: Date = new Date()
): Job | null {
  const agora = now.getTime();
  const upcoming = jobs
    .filter((j) => j.status === "agendado" || j.status === "confirmado")
    .filter((j) => jobInstant(j) >= agora)
    .sort((a, b) => jobInstant(a) - jobInstant(b));
  return upcoming[0] ?? null;
}

/** Todos os atendimentos da semana real de `today` (domingo a sábado), em ordem. */
export function atendimentosDaSemana(
  jobs: readonly Job[],
  today: Date = new Date()
): Job[] {
  const inicio = toISODate(startOfWeek(today));
  const fim = toISODate(addDays(startOfWeek(today), 6));
  return jobs.filter((j) => j.data >= inicio && j.data <= fim).sort(byDataHora);
}

/**
 * Atendimentos depois do sábado da semana real de `today`. Cancelados
 * ficam de fora: a lista não mostra status, e um cancelado ali pareceria
 * um compromisso que ainda vai acontecer.
 */
export function atendimentosProximasSemanas(
  jobs: readonly Job[],
  today: Date = new Date()
): Job[] {
  const fim = toISODate(addDays(startOfWeek(today), 6));
  return jobs
    .filter((j) => j.data > fim && j.status !== "cancelado")
    .sort(byDataHora);
}

/** "Qui 01" — dia da semana abreviado + dia do mês com 2 dígitos, como as linhas do mockup. */
export function formatDiaCurto(iso: string): string {
  const d = parseLocalDate(iso);
  const semana = d
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${dia}`;
}

/** "Quinta, 1 de outubro" — dia por extenso do card do próximo atendimento, sem "-feira". */
export function formatDiaExtenso(iso: string): string {
  const d = parseLocalDate(iso);
  const semana = d
    .toLocaleDateString("pt-BR", { weekday: "long" })
    .replace("-feira", "");
  const resto = d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${resto}`;
}

/** Onde o atendimento acontece, só com dado real: online, o local salvo, ou nada. */
export function localDoAtendimento(job: Job): string | null {
  if (job.modalidade === "online") return "Online";
  return job.local && job.local.trim().length > 0 ? job.local : null;
}

/** Inicial do avatar da lista "Próximas semanas". */
export function inicialDoNome(nome: string): string {
  const letra = nome.trim().charAt(0);
  return letra ? letra.toUpperCase() : "?";
}

/**
 * Faixa da semana com catraca (deslizar para a semana anterior/seguinte):
 * a faixa rola na horizontal entre 3 páginas -- semana anterior, a
 * visível e a seguinte -- com `scroll-snap` por semana inteira. Quando a
 * rolagem assenta numa borda de página, esta função diz qual: -1 (a
 * anterior), 0 (a do meio, nada a fazer) ou 1 (a seguinte). No meio de
 * um arrasto (fora de uma borda) devolve `null`, pra nunca trocar a
 * semana com o dedo ainda na tela. Largura 0 (aba escondida) também é
 * `null`.
 */
export function paginaAoAssentar(
  scrollLeft: number,
  largura: number,
  tolerancia = 2
): -1 | 0 | 1 | null {
  if (largura <= 0) return null;
  const pagina = Math.round(scrollLeft / largura);
  if (Math.abs(scrollLeft - pagina * largura) > tolerancia) return null;
  if (pagina <= 0) return -1;
  if (pagina >= 2) return 1;
  return 0;
}

/** Quantas semanas inteiras `inicio` (um domingo) está da semana de `hoje`
 * (negativo = passado). Arredonda pra absorver a hora a mais/a menos do
 * horário de verão. */
export function semanasDesdeHoje(
  inicio: Date,
  hoje: Date = new Date()
): number {
  const daSemana = startOfWeek(hoje).getTime();
  return Math.round(
    (startOfWeek(inicio).getTime() - daSemana) / (7 * 86_400_000)
  );
}

/** O indicador de qual semana a faixa mostra, em relação a hoje. */
export function rotuloDaSemana(delta: number): string {
  if (delta === 0) return "Esta semana";
  if (delta === 1) return "Próxima semana";
  if (delta === -1) return "Semana passada";
  return delta > 1 ? `Daqui a ${delta} semanas` : `Há ${-delta} semanas`;
}
