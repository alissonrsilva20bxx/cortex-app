/**
 * Stripe simulado do laboratório (/dev-preview/app, sem chaves e sem
 * servidor do Stripe). O "Payment Element" desenha os mesmos campos do
 * desenho aprovado (aba Cartão e Link, número, validade, código, país) e a
 * confirmação devolve aprovado ou recusado (saldo insuficiente, cartão final
 * 9995), conforme `resultadoDoLaboratorio`. Nada é cobrado, nada sai do
 * aparelho.
 */
import type {
  PagamentoAdapter,
  StripeElementoPagamento,
  StripeJs,
} from "./cliente";

export type ResultadoSimulado = "aprovado" | "recusado";

let resultado: ResultadoSimulado = "aprovado";
export function resultadoDoLaboratorio(r: ResultadoSimulado) {
  resultado = r;
}

const CAMPOS = `
  <div class="pe-tabs"><div class="pe-tab on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>Cartão</div><div class="pe-tab" style="opacity:.55"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Link</div></div>
  <div class="pe-label">Número do cartão</div>
  <div class="pe-input">4000 0000 0000 9995<small>VISA</small></div>
  <div class="pe-row"><div><div class="pe-label">Validade</div><div class="pe-input">12 / 28</div></div><div><div class="pe-label">Código de segurança</div><div class="pe-input">123</div></div></div>
  <div class="pe-label">País</div><div class="pe-input">Portugal<small>▾</small></div>`;

function elementoSimulado(): StripeElementoPagamento {
  let alvo: HTMLElement | null = null;
  const prontos: ((e: { complete?: boolean }) => void)[] = [];
  return {
    mount(el) {
      alvo = el;
      el.innerHTML = CAMPOS;
      el.dataset.stripeSimulado = "";
      queueMicrotask(() => prontos.forEach((cb) => cb({})));
    },
    on(evento, cb) {
      if (evento === "ready") prontos.push(cb);
    },
    destroy() {
      if (alvo) alvo.innerHTML = "";
    },
  };
}

const confirmar = async () =>
  resultado === "aprovado"
    ? {}
    : {
        error: {
          type: "card_error",
          code: "card_declined",
          decline_code: "insufficient_funds",
          message: "Seu cartão não tem saldo suficiente.",
          payment_method: { card: { last4: "9995" } },
        },
      };

const stripeSimulado: StripeJs = {
  elements: () => ({ create: () => elementoSimulado() }),
  confirmPayment: confirmar,
  confirmSetup: confirmar,
};

export const pagamentoDeLaboratorio: PagamentoAdapter = {
  chave: () => "pk_test_laboratorio",
  carregarStripe: async () => stripeSimulado,
  iniciar: async () => ({
    ok: true,
    inicio: { tipo: "payment", clientSecret: "pi_laboratorio_secret" },
  }),
};

/** Laboratório sem nem o Stripe simulado: o estado "indisponível". */
export const pagamentoIndisponivel: PagamentoAdapter = {
  chave: () => "",
  carregarStripe: () => Promise.reject(new Error("sem chave")),
  iniciar: async () => ({
    ok: false,
    indisponivel: true,
    erro: "Pagamento ainda não disponível.",
  }),
};
