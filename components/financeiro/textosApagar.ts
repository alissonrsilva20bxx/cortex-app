/** Textos de tela de "Apagar entrada / despesa" (CODING_STANDARDS.md). */
export const APAGAR = {
  tituloEntrada: (descricao: string) => `Apagar a entrada "${descricao}"?`,
  tituloDespesa: (descricao: string) => `Apagar a despesa "${descricao}"?`,
  sim: "Apagar",
  cancelar: "Cancelar",
  falhou: "Não foi possível apagar. Nada foi alterado.",
} as const;
