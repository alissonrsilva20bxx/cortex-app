/** Texto visível do topo da tela de planos (components/assinatura/PlanosTela). */
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
    texto: "Foi uma boa semana. Para seguir usando, escolha um plano.",
  },
} as const;
