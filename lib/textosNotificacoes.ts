/**
 * Texto visível dos lembretes do dia (push). Sem nome de cliente e sem
 * e-mail: a notificação aparece na tela bloqueada.
 */
export const TEXTOS_LEMBRETE = {
  atendimento: {
    titulo: "Lembrete de atendimento",
    corpo: (amanha: boolean, hora: string) =>
      `Você tem um atendimento ${amanha ? "amanhã" : "hoje"} às ${hora}.`,
  },
  recorrente: {
    titulo: "Cliente recorrente",
    corpo:
      "Uma cliente costuma voltar por essa época. Quer confirmar um atendimento?",
  },
} as const;
