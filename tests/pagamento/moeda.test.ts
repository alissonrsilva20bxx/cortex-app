import { describe, expect, it } from "vitest";
import {
  criarAssinatura,
  criarClienteStripe,
  prepararAssinatura,
} from "@/lib/pagamento/stripeApi";
import { centavos } from "@/lib/pagamento/regras";
import { moedaDoStripe } from "@/lib/moeda";
import { planoPorId } from "@/lib/planos";

function stripeSimulado(respostas: Record<string, unknown>[]) {
  const chamadas: { url: string; init: RequestInit; corpo: URLSearchParams }[] =
    [];
  const fazerFetch = (async (url: string, init: RequestInit) => {
    chamadas.push({
      url,
      init,
      corpo: new URLSearchParams(String(init.body ?? "")),
    });
    return new Response(JSON.stringify(respostas.shift() ?? {}), {
      status: 200,
    });
  }) as unknown as typeof fetch;
  return { stripe: criarClienteStripe("sk_test_abc", fazerFetch), chamadas };
}

const subNova = {
  id: "sub_1",
  latest_invoice: { payment_intent: { client_secret: "pi_1_secret" } },
};
const base = {
  cliente: "cus_1",
  produto: "prod_1",
  plano: planoPorId("3m"),
  userId: "user-1",
  cenario: { tipo: "agora" as const },
};

describe("moeda do pedido de assinatura", () => {
  it("moedaDoStripe: usd só para USD; qualquer outro valor vira eur", () => {
    expect(moedaDoStripe("USD")).toBe("usd");
    expect(moedaDoStripe("usd")).toBe("usd");
    expect(moedaDoStripe("EUR")).toBe("eur");
    for (const ruim of ["BRL", "", "dolar", null, undefined, 7, {}, ["USD"]])
      expect(moedaDoStripe(ruim)).toBe("eur");
  });

  it("centavos nas duas moedas (preço do dólar provisório = o do euro)", () => {
    expect(centavos(planoPorId("1m"), "EUR")).toBe(1500);
    expect(centavos(planoPorId("1m"), "USD")).toBe(1500);
    expect(centavos(planoPorId("3m"))).toBe(3000);
  });

  it("euro: a sessão do Stripe sai com currency eur", async () => {
    const { stripe, chamadas } = stripeSimulado([subNova]);
    await criarAssinatura(stripe, { ...base, moeda: "EUR" });
    const c = chamadas[0].corpo;
    expect(c.get("items[0][price_data][currency]")).toBe("eur");
    expect(c.get("items[0][price_data][unit_amount]")).toBe("3000");
    expect(c.get("metadata[moeda]")).toBe("eur");
  });

  it("dólar: a sessão do Stripe sai com currency usd", async () => {
    const { stripe, chamadas } = stripeSimulado([subNova]);
    await criarAssinatura(stripe, { ...base, moeda: "USD" });
    const c = chamadas[0].corpo;
    expect(c.get("items[0][price_data][currency]")).toBe("usd");
    expect(c.get("items[0][price_data][unit_amount]")).toBe("3000");
    expect(c.get("metadata[moeda]")).toBe("usd");
  });

  it("sem moeda ou com moeda inválida: eur", async () => {
    for (const moeda of [undefined, "BRL" as never, "usd" as never]) {
      const { stripe, chamadas } = stripeSimulado([subNova]);
      await criarAssinatura(stripe, { ...base, moeda });
      expect(chamadas[0].corpo.get("items[0][price_data][currency]")).toBe(
        "eur"
      );
    }
  });

  it("não reaproveita a assinatura aberta de outra moeda", async () => {
    const aberta = (moeda?: string) => ({
      data: [
        {
          id: "sub_antiga",
          status: "incomplete",
          metadata: { plano: "3m", ...(moeda ? { moeda } : {}) },
          latest_invoice: { payment_intent: { client_secret: "pi_velha" } },
        },
      ],
    });
    // aberta em euro (ou sem registro, que era euro) + pedido em dólar: cria nova
    for (const antiga of [aberta("eur"), aberta()]) {
      const { stripe, chamadas } = stripeSimulado([antiga, {}, subNova]);
      const r = await prepararAssinatura(stripe, {
        ...base,
        abertura: "abertura-1",
        moeda: "USD",
      });
      expect(r.assinaturaId).toBe("sub_1");
      expect(chamadas.some((c) => c.init.method === "DELETE")).toBe(true);
    }
    // aberta em euro + pedido em euro: reaproveita
    const { stripe, chamadas } = stripeSimulado([aberta("eur")]);
    const r = await prepararAssinatura(stripe, {
      ...base,
      abertura: "abertura-2",
      moeda: "EUR",
    });
    expect(r.assinaturaId).toBe("sub_antiga");
    expect(chamadas).toHaveLength(1);
  });
});
