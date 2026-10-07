/**
 * Arranjo dos atendimentos na Início (Jornada J02): "Próximo", "Esta
 * semana" e "Próximos atendimentos". Só filtra, ordena e agrupa os
 * atendimentos que a tela já recebe -- nenhum cálculo de valor novo.
 * Fica em `.ts` (não `.tsx`) pra ter teste de verdade: o vitest deste
 * projeto roda em "node", sem JSX.
 *
 * Datas sempre no fuso local, nunca via `toISOString()` (UTC): já houve
 * bug neste repositório por data gerada em UTC.
 */
import type { Job } from "@/lib/types";

/** Mesmo critério de "agendado de verdade" do Próximo atendimento. */
const ATIVOS: ReadonlySet<Job["status"]> = new Set(["agendado", "confirmado"]);

export function isAtivo(job: Job): boolean {
  return ATIVOS.has(job.status);
}

/** "YYYY-MM-DD" no fuso local. */
export function dataLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inicioDoDia(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function porDataHora(a: Job, b: Job): number {
  return `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`);
}

/** O próximo atendimento ativo a partir de agora (data + hora). */
export function proximoAtendimento(
  jobs: Job[],
  agora: Date = new Date()
): Job | null {
  const upcoming = jobs
    .filter(isAtivo)
    .filter((j) => new Date(`${j.data}T${j.hora}`) >= agora)
    .sort(porDataHora);
  return upcoming[0] ?? null;
}

/** Último dia da semana corrente (domingo -- a semana começa na segunda). */
export function fimDaSemana(ref: Date = new Date()): Date {
  const d = inicioDoDia(ref);
  const diasAteDomingo = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + diasAteDomingo);
  return d;
}

export interface DiaDaSemana {
  data: string;
  jobs: Job[];
}

/**
 * De hoje até domingo, um item por dia, com os atendimentos ativos daquele
 * dia em ordem de hora. Dia sem atendimento vem com `jobs: []` -- a tela
 * mostra "Dia livre".
 */
export function diasRestantesDaSemana(
  jobs: Job[],
  ref: Date = new Date()
): DiaDaSemana[] {
  const fim = fimDaSemana(ref);
  const dias: DiaDaSemana[] = [];
  for (let d = inicioDoDia(ref); d <= fim; d.setDate(d.getDate() + 1)) {
    const data = dataLocal(d);
    dias.push({
      data,
      jobs: jobs.filter((j) => isAtivo(j) && j.data === data).sort(porDataHora),
    });
  }
  return dias;
}

/**
 * Só os dias de hoje até domingo que têm atendimento (a "Esta semana" do
 * mockup normativo lista dias com agenda, não a semana inteira). Nenhum
 * atendimento some: são os mesmos dias de `diasRestantesDaSemana`, sem os
 * vazios.
 */
export function diasComAtendimentoDaSemana(
  jobs: Job[],
  ref: Date = new Date()
): DiaDaSemana[] {
  return diasRestantesDaSemana(jobs, ref).filter((d) => d.jobs.length > 0);
}

/** Atendimentos ativos depois desta semana, em ordem, até `limite` (6,
 * como a lista "Próximos atendimentos" do mockup normativo). */
export function atendimentosDepoisDaSemana(
  jobs: Job[],
  ref: Date = new Date(),
  limite = 6
): Job[] {
  const fim = dataLocal(fimDaSemana(ref));
  return jobs
    .filter((j) => isAtivo(j) && j.data > fim)
    .sort(porDataHora)
    .slice(0, limite);
}

/** "SEX 25" -- dia da semana curto em maiúsculas + dia do mês. */
export function rotuloDiaCurto(data: string): string {
  const d = new Date(`${data}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const semana = d
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "")
    .toUpperCase();
  return `${semana} ${String(d.getDate()).padStart(2, "0")}`;
}

/** "Sex 25" -- mesma informação, só a primeira letra maiúscula. */
export function rotuloDiaFrase(data: string): string {
  const r = rotuloDiaCurto(data).toLowerCase();
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/** "14h00" */
export function formatHora(hora: string): string {
  const [h, m] = hora.split(":");
  return `${h}h${m ?? "00"}`;
}
