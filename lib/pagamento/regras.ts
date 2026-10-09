/**
 * Regras do Pagamento "C Transparente" (desenho aprovado em
 * pagamento-transparente-stripe.html), sem DOM e sem rede: testadas em
 * tests/lib/pagamentoRegras.test.ts.
 *
 * - Planos em euro (lib/planos.ts): 1 mês € 15, 2 meses € 25, 3 meses € 30.
 * - Quem assina com o teste ainda correndo não paga hoje: a primeira
 *   cobrança cai no fim do teste ("Seu teste continua até DD/MM; a
 *   primeira cobrança é nessa data"). Quem assina com o teste vencido paga
 *   na hora.
 * - Sem teste grátis na tela de pagamento; sem Pix (só cartão).
 */
import type { AssinaturaStatus } from "@/lib/types";
import { diasDoTeste } from "@/lib/assinatura";
import type { Plano } from "@/lib/planos";

/** Quando o teste desta conta termina (a mesma conta de `computeAssinatura`). */
export function fimDoTeste(trialStartedAt: string): Date {
  const fim = new Date(trialStartedAt);
  fim.setDate(fim.getDate() + diasDoTeste(trialStartedAt));
  return fim;
}

export type CenarioDaCobranca =
  /** Teste acabou (ou não há teste): paga hoje. */
  | { tipo: "agora" }
  /** Teste ainda correndo: nada hoje, primeira cobrança em `em`. */
  | { tipo: "fimDoTeste"; em: Date };

/** Paga hoje ou só no fim do teste? Data de início ilegível ou ausente:
 * paga hoje (nunca promete um teste que não existe). */
export function cenarioDaCobranca(
  trialStartedAt: string | null | undefined,
  agora: Date = new Date()
): CenarioDaCobranca {
  if (!trialStartedAt) return { tipo: "agora" };
  const fim = fimDoTeste(trialStartedAt);
  if (Number.isNaN(fim.getTime())) return { tipo: "agora" };
  return fim.getTime() > agora.getTime()
    ? { tipo: "fimDoTeste", em: fim }
    : { tipo: "agora" };
}

/** O dia da primeira cobrança: hoje, ou o fim do teste. */
export function inicioDaCobranca(
  cenario: CenarioDaCobranca,
  agora: Date = new Date()
): Date {
  return cenario.tipo === "fimDoTeste" ? cenario.em : agora;
}

/** A renovação: `meses` depois do início (31/01 + 1 mês = 28/02 ou 29/02). */
export function renovaEm(inicio: Date, meses: number): Date {
  const d = new Date(inicio);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return d;
}

/** "15/10": o formato do desenho, no fuso do aparelho. */
export function formatarDDMM(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "1 mês", "3 meses". */
export function nomeDoPeriodo(meses: number): string {
  return `${meses} ${meses > 1 ? "meses" : "mês"}`;
}

/** Valor em centavos de euro, como o Stripe espera (€ 15 → 1500). */
export function centavos(plano: Plano): number {
  return Math.round(plano.preco * 100);
}

/** Segundos desde 1970, como o Stripe espera em `trial_end`. */
export function emSegundos(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

/**
 * O `assinatura_status` do app a partir do status da assinatura no Stripe:
 *  - `active` / `trialing` / `past_due`: "ativa" (pagou ou assinou no teste;
 *    em `past_due` o Stripe ainda tenta cobrar de novo);
 *  - `canceled` / `unpaid` / `incomplete_expired`: "trial", e o
 *    `computeAssinatura` decide pela data se o teste ainda vale ou venceu;
 *  - `incomplete` / outros: nenhuma mudança (null): o pagamento ainda não
 *    terminou.
 */
export function statusPeloStripe(
  statusStripe: string | null | undefined
): AssinaturaStatus | null {
  switch (statusStripe) {
    case "active":
    case "trialing":
    case "past_due":
      return "ativa";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "trial";
    default:
      return null;
  }
}

/** A chave do Stripe está em modo teste? (pk_test_… / sk_test_…) */
export function chaveDeTeste(chave: string | null | undefined): boolean {
  return Boolean(chave && /^(pk|sk|rk)_test_/.test(chave));
}
