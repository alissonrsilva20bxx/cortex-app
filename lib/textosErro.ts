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
} as const;
