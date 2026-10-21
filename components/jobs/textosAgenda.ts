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
  salvando: "Salvando…",
  editar: "Editar atendimento",
} as const;

/** Erro mostrado quando o status não foi gravado, por status pedido. */
export const ERRO_STATUS = {
  confirmado: "Não foi possível confirmar. Tente de novo.",
  concluído: "Não foi possível marcar como concluído. Tente de novo.",
  cancelado: "Não foi possível marcar como não aconteceu. Tente de novo.",
  foraDoFluxo: "Essa ação não vale para este atendimento agora.",
} as const;

/** A pergunta "Aconteceu?" do atendimento em aberto cujo horário passou. */
export const ACONTECEU = {
  titulo: "Aconteceu?",
  sim: "Sim, concluir",
  nao: "Não aconteceu",
  salvando: "Salvando…",
  /** Quantos outros também esperam resposta, além do mostrado. */
  outros: (n: number) =>
    n === 1 ? "+1 esperando resposta" : `+${n} esperando resposta`,
} as const;
