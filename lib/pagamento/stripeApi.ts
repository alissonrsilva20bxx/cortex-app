/**
 * Cliente mínimo da API REST do Stripe (sem o pacote `stripe`, que não está
 * instalado): `fetch` + corpo `application/x-www-form-urlencoded`, com a
 * versão da API fixa para a resposta não mudar de forma sozinha. Só roda no
 * servidor (a chave secreta nunca vai ao navegador). O `fetch` é injetável
 * para os testes simularem o Stripe.
 */
import type { Plano } from "@/lib/planos";
import { centavos, emSegundos, type CenarioDaCobranca } from "./regras";

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
    metodo: "GET" | "POST",
    caminho: string,
    parametros?: Record<string, Valor>
  ): Promise<T>;
}

export function criarClienteStripe(
  chaveSecreta: string,
  fazerFetch: typeof fetch = fetch
): ClienteStripe {
  return {
    async chamar(metodo, caminho, parametros = {}) {
      const corpo = codificarParaStripe(parametros).join("&");
      const url =
        `https://api.stripe.com/v1/${caminho}` +
        (metodo === "GET" && corpo ? `?${corpo}` : "");
      const r = await fazerFetch(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${chaveSecreta}`,
          "Stripe-Version": VERSAO_DA_API_STRIPE,
          ...(metodo === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
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
  const novo = await stripe.chamar<{ id: string }>("POST", "customers", {
    email: email ?? undefined,
    metadata: { user_id: userId },
  });
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

/**
 * Cria a assinatura do plano, incompleta até o Payment Element confirmar.
 * Só cartão (sem Pix). Com o teste correndo, `trial_end` = fim do teste: o
 * Stripe não cobra hoje e devolve um SetupIntent para guardar o cartão.
 */
export async function criarAssinatura(
  stripe: ClienteStripe,
  args: {
    cliente: string;
    produto: string;
    plano: Plano;
    userId: string;
    cenario: CenarioDaCobranca;
  }
): Promise<AssinaturaCriada> {
  const { cliente, produto, plano, userId, cenario } = args;
  const sub = await stripe.chamar<{
    id: string;
    latest_invoice?: { payment_intent?: { client_secret?: string } | null };
    pending_setup_intent?: { client_secret?: string } | null;
  }>("POST", "subscriptions", {
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
    trial_end:
      cenario.tipo === "fimDoTeste" ? emSegundos(cenario.em) : undefined,
    payment_behavior: "default_incomplete",
    payment_settings: {
      payment_method_types: ["card"],
      save_default_payment_method: "on_subscription",
    },
    metadata: { user_id: userId, plano: plano.id },
    expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
  });
  if (cenario.tipo === "fimDoTeste") {
    const cs = sub.pending_setup_intent?.client_secret;
    if (!cs) throw new ErroDoStripe("Stripe não devolveu o SetupIntent", 502);
    return { tipo: "setup", clientSecret: cs, assinaturaId: sub.id };
  }
  const cs = sub.latest_invoice?.payment_intent?.client_secret;
  if (!cs) throw new ErroDoStripe("Stripe não devolveu o PaymentIntent", 502);
  return { tipo: "payment", clientSecret: cs, assinaturaId: sub.id };
}
