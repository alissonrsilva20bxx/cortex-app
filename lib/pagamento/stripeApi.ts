/**
 * Cliente mínimo da API REST do Stripe (sem o pacote `stripe`, que não está
 * instalado): `fetch` + corpo `application/x-www-form-urlencoded`, com a
 * versão da API fixa para a resposta não mudar de forma sozinha. Só roda no
 * servidor (a chave secreta nunca vai ao navegador). O `fetch` é injetável
 * para os testes simularem o Stripe.
 */
import type { Plano } from "@/lib/planos";
import {
  assinaturaAberta,
  assinaturaValendo,
  centavos,
  emSegundos,
  type AssinaturaDoStripe,
  type CenarioDaCobranca,
} from "./regras";

/** Versão da API do Stripe usada nas chamadas (tem `latest_invoice.payment_intent`). */
export const VERSAO_DA_API_STRIPE = "2024-06-20";

type Valor =
  | string
  | number
  | boolean
  | null
  | undefined
  | Valor[]
  | { [k: string]: Valor };

/** `{ items: [{ price_data: { currency: "eur" } }] }` →
 * `items[0][price_data][currency]=eur` (o formato que o Stripe lê). */
export function codificarParaStripe(
  valor: Record<string, Valor>,
  prefixo = ""
): string[] {
  const partes: string[] = [];
  for (const [k, v] of Object.entries(valor)) {
    const chave = prefixo ? `${prefixo}[${k}]` : k;
    if (v == null) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item != null && typeof item === "object" && !Array.isArray(item))
          partes.push(...codificarParaStripe(item, `${chave}[${i}]`));
        else if (item != null)
          partes.push(
            `${encodeURIComponent(`${chave}[${i}]`)}=${encodeURIComponent(String(item))}`
          );
      });
    } else if (typeof v === "object") {
      partes.push(...codificarParaStripe(v, chave));
    } else {
      partes.push(
        `${encodeURIComponent(chave)}=${encodeURIComponent(String(v))}`
      );
    }
  }
  return partes;
}

export class ErroDoStripe extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo?: string
  ) {
    super(message);
  }
}

export interface ClienteStripe {
  chamar<T = Record<string, unknown>>(
    metodo: "GET" | "POST" | "DELETE",
    caminho: string,
    parametros?: Record<string, Valor>,
    /** Chave de idempotência (só POST): o mesmo pedido repetido devolve o
     * mesmo objeto, nunca cria dois. */
    idempotencia?: string
  ): Promise<T>;
}

export function criarClienteStripe(
  chaveSecreta: string,
  fazerFetch: typeof fetch = fetch
): ClienteStripe {
  return {
    async chamar(metodo, caminho, parametros = {}, idempotencia) {
      const corpo = codificarParaStripe(parametros).join("&");
      const url =
        `https://api.stripe.com/v1/${caminho}` +
        (metodo !== "POST" && corpo ? `?${corpo}` : "");
      const r = await fazerFetch(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${chaveSecreta}`,
          "Stripe-Version": VERSAO_DA_API_STRIPE,
          ...(metodo === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
          ...(metodo === "POST" && idempotencia
            ? { "Idempotency-Key": idempotencia }
            : {}),
        },
        body: metodo === "POST" ? corpo : undefined,
        cache: "no-store",
      });
      const json = (await r.json().catch(() => ({}))) as {
        error?: { message?: string; code?: string };
      };
      if (!r.ok)
        throw new ErroDoStripe(
          json.error?.message ?? `Stripe respondeu ${r.status}`,
          r.status,
          json.error?.code
        );
      return json as never;
    },
  };
}

interface Lista<T> {
  data: T[];
}

/** A cliente no Stripe desta conta (procura pelo `user_id`; cria se não há). */
export async function clienteDaConta(
  stripe: ClienteStripe,
  userId: string,
  email: string | null
): Promise<string> {
  const achados = await stripe.chamar<Lista<{ id: string }>>(
    "GET",
    "customers/search",
    { query: `metadata['user_id']:'${userId.replace(/'/g, "")}'` }
  );
  if (achados.data[0]) return achados.data[0].id;
  // A busca do Stripe demora até ~1 min para ver uma cliente nova: a chave
  // de idempotência impede duas clientes em aberturas seguidas.
  const novo = await stripe.chamar<{ id: string }>(
    "POST",
    "customers",
    { email: email ?? undefined, metadata: { user_id: userId } },
    `jobapp-cliente-${userId}`
  );
  return novo.id;
}

/** O produto "JobApp" no Stripe (procura; cria na 1ª vez). */
export async function produtoDoApp(stripe: ClienteStripe): Promise<string> {
  const achados = await stripe.chamar<Lista<{ id: string }>>(
    "GET",
    "products/search",
    { query: "metadata['app']:'jobapp' AND active:'true'" }
  );
  if (achados.data[0]) return achados.data[0].id;
  const novo = await stripe.chamar<{ id: string }>("POST", "products", {
    name: "JobApp",
    metadata: { app: "jobapp" },
  });
  return novo.id;
}

export interface AssinaturaCriada {
  /** "payment": paga hoje (PaymentIntent); "setup": guarda o cartão e cobra no fim do teste (SetupIntent). */
  tipo: "payment" | "setup";
  clientSecret: string;
  assinaturaId: string;
}

/** A conta já tem uma assinatura que vale (paga, ou no teste com cartão). */
export class ErroJaAtiva extends Error {}

type AssinaturaListada = AssinaturaDoStripe & {
  id: string;
  latest_invoice?: {
    payment_intent?: { client_secret?: string } | null;
  } | null;
  pending_setup_intent?: { client_secret?: string } | null;
};

/** Todas as assinaturas da cliente no Stripe, de qualquer status. */
export async function assinaturasDaCliente(
  stripe: ClienteStripe,
  cliente: string
): Promise<AssinaturaListada[]> {
  const lista = await stripe.chamar<Lista<AssinaturaListada>>(
    "GET",
    "subscriptions",
    {
      customer: cliente,
      status: "all",
      limit: 100,
      expand: [
        "data.latest_invoice.payment_intent",
        "data.pending_setup_intent",
      ],
    }
  );
  return lista.data;
}

function segredoDe(
  sub: AssinaturaListada
): { tipo: "payment" | "setup"; clientSecret: string } | null {
  if (sub.status === "trialing" && sub.pending_setup_intent?.client_secret)
    return {
      tipo: "setup",
      clientSecret: sub.pending_setup_intent.client_secret,
    };
  if (
    sub.status === "incomplete" &&
    sub.latest_invoice?.payment_intent?.client_secret
  )
    return {
      tipo: "payment",
      clientSecret: sub.latest_invoice.payment_intent.client_secret,
    };
  return null;
}

/**
 * Uma assinatura por conta, nunca uma nova a cada abertura da tela:
 *  - já há uma que vale (paga, ou teste com cartão): `ErroJaAtiva` (409);
 *  - há uma aberta (sem cartão) do MESMO plano e do mesmo cenário (hoje ou
 *    no fim do teste): reaproveita o mesmo formulário;
 *  - as outras abertas são canceladas antes de criar a nova (nenhuma delas
 *    cobra, e nenhuma deu "ativa");
 *  - a criação leva a chave de idempotência da abertura: o mesmo pedido
 *    repetido (toque duplo, Strict Mode) devolve a mesma assinatura.
 */
export async function prepararAssinatura(
  stripe: ClienteStripe,
  args: {
    cliente: string;
    produto: string;
    plano: Plano;
    userId: string;
    cenario: CenarioDaCobranca;
    abertura: string;
  }
): Promise<AssinaturaCriada> {
  const subs = await assinaturasDaCliente(stripe, args.cliente);
  if (subs.some(assinaturaValendo)) throw new ErroJaAtiva();
  const statusEsperado =
    args.cenario.tipo === "fimDoTeste" ? "trialing" : "incomplete";
  for (const sub of subs.filter(assinaturaAberta)) {
    const segredo = segredoDe(sub);
    if (
      segredo &&
      sub.status === statusEsperado &&
      sub.metadata?.plano === args.plano.id
    )
      return { ...segredo, assinaturaId: sub.id };
  }
  for (const sub of subs.filter(assinaturaAberta))
    await stripe.chamar("DELETE", `subscriptions/${sub.id}`);
  return criarAssinatura(stripe, args);
}

/**
 * Cria a assinatura do plano, incompleta até o Payment Element confirmar.
 * Só cartão (sem Pix). Com o teste correndo, `trial_end` = fim do teste: o
 * Stripe não cobra hoje e devolve um SetupIntent para guardar o cartão; e
 * se o teste acabar sem cartão, o Stripe CANCELA a assinatura
 * (`trial_settings.end_behavior.missing_payment_method = cancel`), em vez
 * de tentar cobrar e passar por `past_due`.
 */
export async function criarAssinatura(
  stripe: ClienteStripe,
  args: {
    cliente: string;
    produto: string;
    plano: Plano;
    userId: string;
    cenario: CenarioDaCobranca;
    abertura?: string;
  }
): Promise<AssinaturaCriada> {
  const { cliente, produto, plano, userId, cenario, abertura } = args;
  const noTeste = cenario.tipo === "fimDoTeste";
  const sub = await stripe.chamar<{
    id: string;
    latest_invoice?: { payment_intent?: { client_secret?: string } | null };
    pending_setup_intent?: { client_secret?: string } | null;
  }>(
    "POST",
    "subscriptions",
    {
      customer: cliente,
      items: [
        {
          price_data: {
            currency: "eur",
            product: produto,
            unit_amount: centavos(plano),
            recurring: { interval: "month", interval_count: plano.meses },
          },
        },
      ],
      trial_end: noTeste ? emSegundos(cenario.em) : undefined,
      trial_settings: noTeste
        ? { end_behavior: { missing_payment_method: "cancel" } }
        : undefined,
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        user_id: userId,
        plano: plano.id,
        abertura: abertura ?? undefined,
      },
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
    },
    abertura ? `jobapp-assinatura-${userId}-${abertura}` : undefined
  );
  if (noTeste) {
    const cs = sub.pending_setup_intent?.client_secret;
    if (!cs) throw new ErroDoStripe("Stripe não devolveu o SetupIntent", 502);
    return { tipo: "setup", clientSecret: cs, assinaturaId: sub.id };
  }
  const cs = sub.latest_invoice?.payment_intent?.client_secret;
  if (!cs) throw new ErroDoStripe("Stripe não devolveu o PaymentIntent", 502);
  return { tipo: "payment", clientSecret: cs, assinaturaId: sub.id };
}
