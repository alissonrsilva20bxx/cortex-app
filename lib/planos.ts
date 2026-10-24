/**
 * Planos do JobApp depois do teste grátis (onboarding "Linha do tempo",
 * desenho aprovado em onboarding-linha-do-tempo.html). Cada plano tem preço
 * em euro e em dólar (a moeda que a pessoa escolheu):
 *
 *   1 mês     15
 *   2 meses   25  (cheio 30, economiza 5,  −17%)
 *   3 meses   30  (cheio 45, economiza 15, −33%)
 *
 * PROVISÓRIO: o preço em dólar é o mesmo número do euro até o capitão
 * decidir os valores em USD. Os dois maiores levam o selo "preço por tempo
 * limitado". Não há plano Garçom. O mesmo acesso a tudo em todos os planos.
 * O símbolo e o código da moeda são escritos só por `formatMoeda`
 * (lib/moeda.ts).
 *
 * Lógica pura (sem DOM): testada em tests/lib/planos.test.ts.
 */

import { MOEDA_PADRAO, lerMoeda, type Moeda } from "@/lib/moeda";

export type PlanoId = "1m" | "2m" | "3m";

/** Os preços de um plano numa moeda. */
export interface PrecoDoPlano {
  /** Preço do período. */
  preco: number;
  /** Preço cheio riscado (só nos planos em promoção). */
  cheio: number | null;
}

export interface Plano {
  id: PlanoId;
  nome: string;
  meses: number;
  /** Preço em cada moeda aceita. */
  precos: Record<Moeda, PrecoDoPlano>;
}

const SEM_PROMOCAO: PrecoDoPlano = { preco: 15, cheio: null };
const DOIS_MESES: PrecoDoPlano = { preco: 25, cheio: 30 };
const TRES_MESES: PrecoDoPlano = { preco: 30, cheio: 45 };

export const PLANOS: readonly Plano[] = [
  {
    id: "1m",
    nome: "1 mês",
    meses: 1,
    precos: { EUR: SEM_PROMOCAO, USD: SEM_PROMOCAO },
  },
  {
    id: "2m",
    nome: "2 meses",
    meses: 2,
    precos: { EUR: DOIS_MESES, USD: DOIS_MESES },
  },
  {
    id: "3m",
    nome: "3 meses",
    meses: 3,
    precos: { EUR: TRES_MESES, USD: TRES_MESES },
  },
];

/** O plano que nasce marcado na tela de escolha (o desenho marca 3 meses). */
export const PLANO_PADRAO: PlanoId = "3m";

export function planoPorId(id: PlanoId): Plano {
  return PLANOS.find((p) => p.id === id) ?? PLANOS[0];
}

/** Preço do período na moeda (moeda inválida vira euro). */
export function precoDoPlano(
  plano: Plano,
  moeda: Moeda = MOEDA_PADRAO
): number {
  return plano.precos[lerMoeda(moeda)].preco;
}

/** Preço cheio riscado na moeda (null sem promoção). */
export function cheioDoPlano(
  plano: Plano,
  moeda: Moeda = MOEDA_PADRAO
): number | null {
  return plano.precos[lerMoeda(moeda)].cheio;
}

/** Quanto sai por mês (12,50 no de 2 meses, 10 no de 3). */
export function precoPorMes(
  plano: Plano,
  moeda: Moeda = MOEDA_PADRAO
): number {
  return precoDoPlano(plano, moeda) / plano.meses;
}

/** Quanto economiza contra o preço cheio (0 sem promoção). */
export function economia(plano: Plano, moeda: Moeda = MOEDA_PADRAO): number {
  const cheio = cheioDoPlano(plano, moeda);
  return cheio == null ? 0 : cheio - precoDoPlano(plano, moeda);
}

/** O selo de desconto, arredondado (17 e 33). */
export function percentualDesconto(
  plano: Plano,
  moeda: Moeda = MOEDA_PADRAO
): number {
  const cheio = cheioDoPlano(plano, moeda);
  return cheio == null
    ? 0
    : Math.round(((cheio - precoDoPlano(plano, moeda)) / cheio) * 100);
}

/** O menor preço por mês entre os planos (o "a partir de 10 por mês"). */
export function menorPrecoPorMes(moeda: Moeda = MOEDA_PADRAO): number {
  return Math.min(...PLANOS.map((p) => precoPorMes(p, moeda)));
}

/**
 * Ponto de entrada da tela de Pagamento: a tela de escolha de plano chama
 * `onEscolherPlano(plano)` com o plano marcado. Quem fizer o Pagamento troca
 * o que a página passa aqui; até lá, a página leva ao fluxo de hoje
 * (Ajustes › Assinatura e dados), sem cobrar nada.
 */
export type OnEscolherPlano = (plano: Plano) => void;

const chavePlanoEscolhido = (userId: string) =>
  `jobapp-plano-escolhido:${userId}`;

/** Guarda o plano escolhido neste aparelho, para o Pagamento retomar. Nunca
 * lança. */
export function guardarPlanoEscolhido(userId: string, plano: Plano): void {
  try {
    localStorage.setItem(chavePlanoEscolhido(userId), plano.id);
  } catch {
    /* sem storage: o Pagamento pergunta de novo */
  }
}

/** O plano escolhido antes, se houver. */
export function planoEscolhido(userId: string): PlanoId | null {
  try {
    const v = localStorage.getItem(chavePlanoEscolhido(userId));
    return v === "1m" || v === "2m" || v === "3m" ? v : null;
  } catch {
    return null;
  }
}
