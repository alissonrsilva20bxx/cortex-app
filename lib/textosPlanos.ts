/** Texto visível sobre os planos: o topo da tela de planos
 * (components/assinatura/PlanosTela), o aviso dos 2 dias (AvisoTeste), o
 * passo "O teste termina" das boas-vindas (OnboardingFlow) e a linha do
 * plano nos Ajustes (AjustesTab). Depois do teste só a Rede para; o resto
 * do app segue liberado (capitão, 27/10). */
export const TEXTOS_PLANOS = {
  /** Aberta pelo "Ver planos" com o teste ainda valendo. */
  noTeste: {
    titulo: (faltam: number) =>
      faltam === 1
        ? "Falta 1 dia do seu teste"
        : `Faltam ${faltam} dias do seu teste`,
    texto: "Escolha agora ou quando o teste acabar.",
  },
  /** O teste acabou. */
  fim: {
    titulo: (diasDoTeste: number) => `Seus ${diasDoTeste} dias terminaram`,
    /** "Foi uma boa semana." só no teste de 7 dias (quem começou antes
     * do corte teve 14). */
    texto: (diasDoTeste: number) =>
      `${diasDoTeste === 7 ? "Foi uma boa semana. " : ""}Para seguir com a Rede, renove escolhendo um plano. O resto do app continua liberado.`,
  },
  /** O aviso no Início quando faltam 2 dias. */
  aviso: "Depois, a Rede pede um plano. O resto do app continua liberado.",
  /** Boas-vindas, passo "O teste termina": o menor preço por mês. */
  onboardingFim: (precoPorMes: string) =>
    `Para seguir com a Rede, você escolhe um plano, a partir de ${precoPorMes} por mês.`,
  /** Ajustes › Conta: a linha do plano pago (o plano se chama só "Rede"). */
  ajustesLinha: "Plano Rede",
  /** Ajustes › Conta: o valor ao lado de "Plano Rede". */
  ajustesValor: {
    teste: (dias: number) =>
      `Teste grátis · ${dias} ${dias === 1 ? "dia" : "dias"}`,
    terminou: "Teste terminou",
    ativo: "Ativo",
  },
  /** Pagamento (app/api/pagamento/assinatura): pedir o plano já pago. */
  jaAtiva: "Seu Plano Rede já está ativo.",
  /** Pagamento: os outros erros da rota da assinatura e do lado do
   * aparelho (lib/pagamento/cliente). */
  pagamento: {
    planoInvalido: "Plano inválido",
    naoIniciou: "Não foi possível iniciar o pagamento agora.",
    semConexao: "Sem conexão. Tente de novo.",
    /** Cartão recusado (tela de erro do PagamentoTela): no lugar da
     * mensagem crua do Stripe, que vem no idioma dele (R22). */
    recusa:
      "Confira os dados do cartão e tente de novo. Se continuar, use outro cartão.",
    /** Saldo/limite insuficiente (R25): o cartão está certo, falta limite --
     * "confira os dados" mandaria a pessoa conferir o que já está certo. */
    recusaSaldo:
      "O cartão não tem limite disponível para esta cobrança. Tente outro cartão.",
  },
} as const;
