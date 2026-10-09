/**
 * O lado do aparelho do Pagamento: carregar o Stripe.js (sempre de
 * https://js.stripe.com/v3, como o Stripe exige; o pacote @stripe/stripe-js
 * não está instalado e não é preciso) e pedir ao servidor a assinatura.
 *
 * Tudo passa por um adaptador trocável, como a confirmação da conta da tela
 * de bloqueio (lib/reauth.ts): o app usa o Stripe de verdade; o laboratório
 * (/dev-preview/app, sem chaves) usa um Stripe simulado, para a tela poder
 * ser vista e testada de ponta a ponta sem cobrar nada.
 */
import type { Plano } from "@/lib/planos";

/** A chave publicável (pk_…), embutida no build. Sem ela: "pagamento
 * ainda não disponível". */
export const CHAVE_PUBLICAVEL =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/** O pedaço do Stripe.js que a tela usa (tipos mínimos, sem o pacote). */
export interface StripeElementoPagamento {
  mount(el: HTMLElement): void;
  on(evento: "ready" | "change", cb: (e: { complete?: boolean }) => void): void;
  destroy(): void;
}
export interface StripeElements {
  create(
    tipo: "payment",
    opcoes?: Record<string, unknown>
  ): StripeElementoPagamento;
}
export interface ErroDoStripeJs {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
  payment_method?: { card?: { last4?: string } };
}
export interface StripeJs {
  elements(opcoes: Record<string, unknown>): StripeElements;
  confirmPayment(
    opcoes: Record<string, unknown>
  ): Promise<{ error?: ErroDoStripeJs }>;
  confirmSetup(
    opcoes: Record<string, unknown>
  ): Promise<{ error?: ErroDoStripeJs }>;
}

export interface InicioDoPagamento {
  tipo: "payment" | "setup";
  clientSecret: string;
}

export type ResultadoDoInicio =
  | { ok: true; inicio: InicioDoPagamento }
  | { ok: false; indisponivel: boolean; erro: string };

export interface PagamentoAdapter {
  /** A chave publicável (vazia = pagamento indisponível). */
  chave(): string;
  carregarStripe(chave: string): Promise<StripeJs>;
  iniciar(plano: Plano): Promise<ResultadoDoInicio>;
}

let carregando: Promise<StripeJs> | null = null;

/** Injeta o <script> do Stripe.js uma vez e devolve `Stripe(chave)`. */
function carregarStripeJs(chave: string): Promise<StripeJs> {
  if (!carregando)
    carregando = new Promise<StripeJs>((ok, falha) => {
      const w = window as unknown as {
        Stripe?: (k: string, o?: Record<string, unknown>) => StripeJs;
      };
      const pronto = () =>
        w.Stripe
          ? ok(w.Stripe(chave, { locale: "pt-BR" }))
          : falha(new Error("Stripe.js não carregou"));
      if (w.Stripe) return pronto();
      const s = document.createElement("script");
      s.src = "https://js.stripe.com/v3";
      s.async = true;
      s.onload = pronto;
      s.onerror = () => {
        carregando = null;
        falha(new Error("Stripe.js não carregou"));
      };
      document.head.appendChild(s);
    });
  return carregando;
}

export const pagamentoStripe: PagamentoAdapter = {
  chave: () => CHAVE_PUBLICAVEL,
  carregarStripe: carregarStripeJs,
  async iniciar(plano) {
    try {
      const r = await fetch("/api/pagamento/assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: plano.id }),
      });
      const json = (await r.json().catch(() => ({}))) as {
        tipo?: "payment" | "setup";
        clientSecret?: string;
        indisponivel?: boolean;
        error?: string;
      };
      if (r.ok && json.clientSecret && json.tipo)
        return {
          ok: true,
          inicio: { tipo: json.tipo, clientSecret: json.clientSecret },
        };
      return {
        ok: false,
        indisponivel: Boolean(json.indisponivel),
        erro: json.error ?? "Não foi possível iniciar o pagamento agora.",
      };
    } catch {
      return {
        ok: false,
        indisponivel: false,
        erro: "Sem conexão. Tente de novo.",
      };
    }
  },
};

let atual: PagamentoAdapter = pagamentoStripe;
/** O laboratório troca pelo Stripe simulado. */
export function usarPagamento(adaptador: PagamentoAdapter | null) {
  atual = adaptador ?? pagamentoStripe;
}
export function pagamentoAtual(): PagamentoAdapter {
  return atual;
}

/** "saldo insuficiente": o motivo da recusa, no texto da tela de erro. */
export function motivoDaRecusa(
  erro: ErroDoStripeJs | null | undefined
): string {
  switch (erro?.decline_code ?? erro?.code) {
    case "insufficient_funds":
      return "saldo insuficiente";
    case "expired_card":
      return "cartão vencido";
    case "incorrect_cvc":
      return "código de segurança incorreto";
    case "lost_card":
    case "stolen_card":
    case "pickup_card":
      return "cartão bloqueado";
    case "processing_error":
      return "erro no processamento";
    case "authentication_required":
    case "payment_intent_authentication_failure":
    case "setup_intent_authentication_failure":
      return "a confirmação do banco não foi concluída";
    default:
      return "cartão recusado";
  }
}
