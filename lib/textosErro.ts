/**
 * Erro visível quando salvar ou enviar falha no banco (sem internet, banco
 * recusou). A mensagem crua do Supabase vem em inglês e não vai para a tela
 * (R21).
 */
export const TEXTOS_ERRO = {
  salvar: "Não foi possível salvar. Confira a internet e tente de novo.",
  /** Sem internet ou arquivo acima do limite do Storage. */
  enviarArquivo:
    "Não foi possível enviar o arquivo. Confira a internet ou tente um arquivo menor.",
  /** Notificação push (lib/push): o erro do navegador e o do banco chegam
   * em inglês, então a tela mostra um texto nosso (R22). */
  notificacao: {
    ativar:
      "Não foi possível ativar as notificações. Confira a permissão nas configurações e tente de novo.",
    desativar: "Não foi possível desativar as notificações. Tente de novo.",
  },
} as const;
