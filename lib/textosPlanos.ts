/** Texto visível sobre os planos: o topo da tela de planos
 * (components/assinatura/PlanosTela), o aviso dos 2 dias (AvisoTeste) e o
 * passo "O teste termina" das boas-vindas (OnboardingFlow). Depois do
 * teste só a Rede para; o resto do app segue liberado (capitão, 27/10). */
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
    texto:
      "Foi uma boa semana. Para seguir com a Rede, renove escolhendo um plano. O resto do app continua liberado.",
  },
  /** O aviso no Início quando faltam 2 dias. */
  aviso: "Depois, a Rede pede um plano. O resto do app continua liberado.",
  /** Boas-vindas, passo "O teste termina": o menor preço por mês. */
  onboardingFim: (precoPorMes: string) =>
    `Para seguir com a Rede, você escolhe um plano, a partir de ${precoPorMes} por mês.`,
} as const;
