/** Texto visível da tela de renovação da Rede
 * (components/rede/RedeRenovacao.tsx): aparece só quando o teste acabou e
 * não há assinatura. O resto do app segue liberado. */
export const TEXTOS_RENOVACAO_REDE = {
  titulo: "Rede",
  chamada: "Seu teste da Rede acabou",
  texto:
    "Para seguir com a Rede, renove escolhendo um plano. O resto do app continua liberado.",
  beneficiosTitulo: "O que volta com a Rede",
  beneficios: [
    "Trocar experiências com segurança",
    "Tirar dúvidas com quem entende sua rotina",
    "Criar conexões profissionais",
    "Conversar em privado",
    "Organizar seu perfil e LiveLinks",
  ],
  planos: (lista: string) => `Planos: ${lista}`,
  dados: "Seu perfil, amigas e conversas continuam guardados.",
  botao: "Ver planos",
} as const;
