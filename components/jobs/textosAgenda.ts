/**
 * Textos de tela da Agenda e do fluxo de status do atendimento. Um lugar só,
 * para não caçar string solta nos componentes (CODING_STANDARDS.md).
 */

export const TOTAL_PREVISTO = {
  hoje: "Previsto de hoje",
  dia: "Previsto do dia",
} as const;

/** Botões do fluxo de status (detalhe do atendimento). */
export const BOTOES_STATUS = {
  confirmar: "Confirmar",
  concluir: "Concluir",
  naoAconteceu: "Não aconteceu",
  desmarcou: "Cliente desmarcou",
  salvando: "Salvando…",
  editar: "Editar atendimento",
} as const;

/** Confirmação do "Cliente desmarcou" (antes do horário). */
export const CONFIRMA_DESMARCOU = {
  desmarcar: "Desmarcar",
  voltar: "Voltar",
} as const;

/** Erro mostrado quando o status não foi gravado, por status pedido. */
export const ERRO_STATUS = {
  confirmado: "Não foi possível confirmar. Tente de novo.",
  concluído: "Não foi possível marcar como concluído. Tente de novo.",
  cancelado: "Não foi possível marcar como não aconteceu. Tente de novo.",
  foraDoFluxo: "Essa ação não vale para este atendimento agora.",
} as const;

/** Recusa do formulário quando o status não vale para a data e a hora. */
export const ERRO_FORM_STATUS =
  "Esse status não vale para a data e a hora escolhidas. Concluído e Não aconteceu só a partir do horário; Confirmado só antes dele.";

/** A pergunta "Aconteceu?" do atendimento em aberto cujo horário passou. */
export const ACONTECEU = {
  titulo: "Aconteceu?",
  sim: "Sim, concluir",
  nao: "Não aconteceu",
  salvando: "Salvando…",
  /** Abre a lista completa quando há mais do que a Agenda mostra. */
  verTodos: (n: number) => `Ver todos (${n})`,
  verMenos: "Ver menos",
  /** Quantos outros também esperam resposta, além do mostrado. */
  outros: (n: number) =>
    n === 1 ? "+1 esperando resposta" : `+${n} esperando resposta`,
} as const;

/** O botão "Descanso" da Agenda: o descanso de propósito que a Jornada pede. */
export const DESCANSO = {
  botao: "Descanso",
  /** Hoje marcado como descanso. */
  feito: "Descansou",
  /** Dia futuro marcado como descanso. */
  planejado: "Vai descansar",
  /** Dia marcado: tocar de novo desfaz. */
  motivoDesfazer: "Toque de novo para desfazer",
  /** Por que está desabilitado num dia com atendimento. */
  motivoComAtendimento: "Dia com atendimento",
  /** Por que está desabilitado num dia que já passou. */
  motivoPassou: "Esse dia já passou",
} as const;

/** Resumo da semana (sheet do botão "Resumo" da Agenda): só tempo, sem dinheiro. */
export const RESUMO_SEMANA = {
  titulo: "Resumo da semana",
  feitos: "Feitos",
  pelaFrente: "Pela frente",
  desmarcados: "Desmarcados",
  diasLivres: "Dias livres",
  semanaLivre: "Semana livre. Nenhum atendimento marcado.",
  nadaMaisMarcado: "Nada mais marcado esta semana.",
  /** Semana viva: as etiquetas de cada atendimento no detalhe do dia. */
  tagFeito: "Feito",
  tagPelaFrente: "Pela frente",
  tagDesmarcado: "Desmarcado",
  diasDaSemana: "Dias da semana",
  diaLivre: "Dia livre.",
  diaSemAtendimento: "Dia sem atendimento.",
  /** "+2" quando o dia tem mais bolinhas do que cabem na pilha. */
  mais: (n: number) => `+${n}`,
  /** "18 a 24 out" / "28 set a 4 out": as duas pontas já montadas. */
  periodoDe: (inicio: string, fim: string) => `${inicio} a ${fim}`,
  /** "Hoje, quinta 22" / "Terça 20". */
  tituloDia: (hoje: boolean, nome: string, numero: number) =>
    hoje ? `Hoje, ${nome.toLowerCase()} ${numero}` : `${nome} ${numero}`,
} as const;

/** Nome de cada dia, indexado por `Date.getDay()` (0 = domingo), sem "-feira". */
export const NOMES_DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

/** "1 atendimento" / "2 atendimentos". */
export function atendimentosPorExtenso(n: number): string {
  return `${n} ${n === 1 ? "atendimento" : "atendimentos"}`;
}

/** "Quinta está livre." / "Quinta e sexta estão livres." (nomes já em ordem). */
export function fraseDiasLivres(nomes: readonly string[]): string {
  if (nomes.length === 0) return "";
  if (nomes.length === 1) return `${nomes[0]} está livre.`;
  return `${nomes[0]} e ${nomes[1].toLowerCase()} estão livres.`;
}
