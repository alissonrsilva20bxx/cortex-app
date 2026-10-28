/** Texto visível do login, do cadastro e da troca de senha. */
export const TEXTOS_AUTH = {
  erro: {
    credenciais: "E-mail ou senha incorretos.",
    emailNaoConfirmado: "Confirme seu e-mail antes de entrar.",
    jaCadastrado: "Já existe uma conta com este e-mail. Tente entrar.",
    senhaCurta: (minimo: number | null) =>
      minimo
        ? `Senha muito curta — use pelo menos ${minimo} caracteres.`
        : "Senha muito curta.",
    senhaSemVariedade: (itens: string[]) =>
      itens.length > 0
        ? `A senha precisa ter pelo menos ${juntarComE(itens)}.`
        : "A senha precisa misturar letras e números.",
    senhaVazada: "Essa senha é conhecida e fácil de adivinhar. Escolha outra.",
    senhaFraca: "Senha fraca. Escolha uma mais difícil de adivinhar.",
    muitasTentativas: "Muitas tentativas. Aguarde um momento e tente de novo.",
    emailInvalido: "E-mail inválido.",
    generico: "Não foi possível concluir. Tente novamente.",
  },
  /** "Reenviar e-mail" de confirmação do cadastro (R17 M5). */
  reenvio: {
    pergunta: "Não chegou o e-mail?",
    botao: "Reenviar e-mail",
    enviando: "Reenviando…",
    aguarde: (segundos: number) => `Reenviar em ${segundos} s`,
    ok: "Mandamos de novo. Confira também o spam.",
  },
  /** O que falta na senha, na ordem em que o Supabase lista. */
  variedade: {
    minuscula: "uma letra minúscula",
    maiuscula: "uma letra maiúscula",
    numero: "um número",
    simbolo: "um símbolo",
  },
} as const;

function juntarComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}
