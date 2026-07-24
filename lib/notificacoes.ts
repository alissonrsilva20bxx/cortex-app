import type { Job } from "@/lib/types";

/**
 * Motor de conteúdo das notificações (§7.3): opt-in e valiosas, nunca spam.
 * No máximo uma por dia por usuária — prioridade: atendimento que se
 * aproxima primeiro; senão, um insight de cliente recorrente. Se não há
 * nada de fato relevante, fica em silêncio (mesmo espírito do RecapSheet:
 * nunca cobra um dia parado).
 *
 * Nota de escopo: o spec original citava "lembrete de check-in" como
 * exemplo — isso pertence à Segurança pessoal (fase 2, ainda não
 * construída). Aqui entra o "lembrete de atendimento", que cobre o mesmo
 * papel (lembrar de um compromisso que vem aí) com o que já existe hoje.
 */

export interface Lembrete {
  title: string;
  body: string;
  tag: string;
}

const DIA_MS = 86_400_000;

function formatHora(hora: string): string {
  const [h, m] = hora.split(":");
  return `${h}h${m}`;
}

/** Próximo atendimento agendado/confirmado nas próximas ~36h, se houver. */
function atendimentoProximo(jobs: Job[], ref: Date): Lembrete | null {
  const limite = new Date(ref.getTime() + 36 * 60 * 60 * 1000);
  const proximo = jobs
    .filter((j) => j.status === "agendado" || j.status === "confirmado")
    .map((j) => ({ job: j, quando: new Date(`${j.data}T${j.hora}`) }))
    .filter(({ quando }) => quando > ref && quando <= limite)
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())[0];

  if (!proximo) return null;

  const amanha = proximo.quando.toDateString() !== ref.toDateString();
  return {
    title: "Lembrete de atendimento",
    body: `${proximo.job.clienteNome}, ${amanha ? "amanhã" : "hoje"} às ${formatHora(proximo.job.hora)}.`,
    tag: "atendimento-proximo",
  };
}

/**
 * Cliente com 2+ atendimentos concluídos cujo intervalo médio entre eles
 * sugere que "está na hora de voltar" (dentro dos próximos 7 dias),
 * desde que não haja já um atendimento futuro marcado com ela.
 */
function clienteRecorrente(jobs: Job[], ref: Date): Lembrete | null {
  const porCliente = new Map<string, Job[]>();
  for (const j of jobs) {
    if (j.status !== "concluído") continue;
    const lista = porCliente.get(j.clienteNome) ?? [];
    lista.push(j);
    porCliente.set(j.clienteNome, lista);
  }

  const temFuturo = new Set(
    jobs
      .filter((j) => j.status === "agendado" || j.status === "confirmado")
      .map((j) => j.clienteNome)
  );

  for (const [nome, atendimentos] of porCliente) {
    if (atendimentos.length < 2 || temFuturo.has(nome)) continue;

    const datas = atendimentos
      .map((j) => new Date(`${j.data}T${j.hora}`).getTime())
      .sort((a, b) => a - b);
    const intervalos = datas.slice(1).map((d, i) => d - datas[i]);
    const mediaMs = intervalos.reduce((s, v) => s + v, 0) / intervalos.length;

    const ultima = datas[datas.length - 1];
    const prevista = ultima + mediaMs;
    const diasAteFrente = (prevista - ref.getTime()) / DIA_MS;

    if (diasAteFrente >= 0 && diasAteFrente <= 7) {
      return {
        title: "Cliente recorrente",
        body: `${nome} costuma voltar por essa época — quer confirmar um atendimento?`,
        tag: "cliente-recorrente",
      };
    }
  }

  return null;
}

/** Um lembrete no máximo, ou nada se não houver nada relevante hoje. */
export function proximoLembrete(
  jobs: Job[],
  ref = new Date()
): Lembrete | null {
  return atendimentoProximo(jobs, ref) ?? clienteRecorrente(jobs, ref);
}
