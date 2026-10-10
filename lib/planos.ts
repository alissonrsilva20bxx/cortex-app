/**
 * Planos do JobApp depois do teste grátis (onboarding "Linha do tempo",
 * desenho aprovado em onboarding-linha-do-tempo.html). Em euro:
 *
 *   1 mês     € 15
 *   2 meses   € 25  (cheio € 30, economiza € 5,  −17%)
 *   3 meses   € 30  (cheio € 45, economiza € 15, −33%)
 *
 * Os dois maiores levam o selo "preço por tempo limitado". Não há plano
 * Garçom. O mesmo acesso a tudo em todos os planos.
 *
 * Lógica pura (sem DOM): testada em tests/lib/planos.test.ts.
 */

export type PlanoId = "1m" | "2m" | "3m";

export interface Plano {
  id: PlanoId;
  nome: string;
  meses: number;
  /** Preço do período, em euro. */
  preco: number;
  /** Preço cheio riscado (só nos planos em promoção). */
  cheio: number | null;
}

export const PLANOS: readonly Plano[] = [
  { id: "1m", nome: "1 mês", meses: 1, preco: 15, cheio: null },
  { id: "2m", nome: "2 meses", meses: 2, preco: 25, cheio: 30 },
  { id: "3m", nome: "3 meses", meses: 3, preco: 30, cheio: 45 },
];

/** O plano que nasce marcado na tela de escolha (o desenho marca 3 meses). */
export const PLANO_PADRAO: PlanoId = "3m";

export function planoPorId(id: PlanoId): Plano {
  return PLANOS.find((p) => p.id === id) ?? PLANOS[0];
}

/** Quanto sai por mês (€ 12,50 no de 2 meses, € 10 no de 3). */
export function precoPorMes(plano: Plano): number {
  return plano.preco / plano.meses;
}

/** Quanto economiza contra o preço cheio (0 sem promoção). */
export function economia(plano: Plano): number {
  return plano.cheio == null ? 0 : plano.cheio - plano.preco;
}

/** O selo de desconto, arredondado (17 e 33). */
export function percentualDesconto(plano: Plano): number {
  return plano.cheio == null
    ? 0
    : Math.round(((plano.cheio - plano.preco) / plano.cheio) * 100);
}

/** "€ 15", "€ 12,50": o formato do desenho. */
export function formatarEuro(valor: number): string {
  return `€ ${Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace(".", ",")}`;
}

/** O menor preço por mês entre os planos (o "a partir de € 10 por mês"). */
export function menorPrecoPorMes(): number {
  return Math.min(...PLANOS.map(precoPorMes));
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
