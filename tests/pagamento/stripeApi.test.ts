import { describe, expect, it } from "vitest";
import {
  ErroDoStripe,
  VERSAO_DA_API_STRIPE,
  clienteDaConta,
  codificarParaStripe,
  criarAssinatura,
  criarClienteStripe,
} from "@/lib/pagamento/stripeApi";
import { planoPorId } from "@/lib/planos";

/** Stripe simulado: grava cada chamada e responde o que o teste mandar. */
function stripeSimulado(respostas: Record<string, unknown>[], status = 200) {
  const chamadas: { url: string; init: RequestInit; corpo: URLSearchParams }[] =
    [];
  const fazerFetch = (async (url: string, init: RequestInit) => {
    chamadas.push({
      url,
      init,
      corpo: new URLSearchParams(String(init.body ?? "")),
    });
    return new Response(JSON.stringify(respostas.shift() ?? {}), { status });
  }) as unknown as typeof fetch;
  return { stripe: criarClienteStripe("sk_test_abc", fazerFetch), chamadas };
}

describe("codificação no formato do Stripe", () => {
  it("objetos e listas viram colchetes", () => {
    expect(
      codificarParaStripe({
        items: [{ price_data: { currency: "eur", unit_amount: 1500 } }],
        expand: ["a", "b"],
        nada: undefined,
      })
    ).toEqual([
      "items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=eur",
      "items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=1500",
      "expand%5B0%5D=a",
      "expand%5B1%5D=b",
    ]);
  });
});

describe("a chamada ao Stripe", () => {
  it("chave secreta no cabeçalho e versão da API fixa", async () => {
    const { stripe, chamadas } = stripeSimulado([{ data: [{ id: "cus_1" }] }]);
    await clienteDaConta(stripe, "user-1", "a@b.c");
    const h = chamadas[0].init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer sk_test_abc");
    expect(h["Stripe-Version"]).toBe(VERSAO_DA_API_STRIPE);
  });

  it("cliente: procura pelo user_id e só cria se não acha", async () => {
    const a = stripeSimulado([{ data: [{ id: "cus_1" }] }]);
    expect(await clienteDaConta(a.stripe, "user-1", "a@b.c")).toBe("cus_1");
    expect(a.chamadas).toHaveLength(1);
    expect(decodeURIComponent(a.chamadas[0].url)).toContain(
      "metadata['user_id']:'user-1'"
    );

    const b = stripeSimulado([{ data: [] }, { id: "cus_novo" }]);
    expect(await clienteDaConta(b.stripe, "user-1", "a@b.c")).toBe("cus_novo");
    expect(b.chamadas[1].corpo.get("metadata[user_id]")).toBe("user-1");
    expect(b.chamadas[1].corpo.get("email")).toBe("a@b.c");
  });

  it("erro do Stripe vira ErroDoStripe", async () => {
    const { stripe } = stripeSimulado(
      [{ error: { message: "ruim", code: "x" } }],
      402
    );
    await expect(clienteDaConta(stripe, "u", null)).rejects.toBeInstanceOf(
      ErroDoStripe
    );
  });
});

describe("criar a assinatura do plano", () => {
  it("teste acabou: cobra hoje, em euro, só cartão, PaymentIntent", async () => {
    const { stripe, chamadas } = stripeSimulado([
      {
        id: "sub_1",
        latest_invoice: { payment_intent: { client_secret: "pi_1_secret" } },
      },
    ]);
    const r = await criarAssinatura(stripe, {
      cliente: "cus_1",
      produto: "prod_1",
      plano: planoPorId("3m"),
      userId: "user-1",
      cenario: { tipo: "agora" },
    });
    expect(r).toEqual({
      tipo: "payment",
      clientSecret: "pi_1_secret",
      assinaturaId: "sub_1",
    });
    const c = chamadas[0].corpo;
    expect(chamadas[0].url).toBe("https://api.stripe.com/v1/subscriptions");
    expect(c.get("items[0][price_data][currency]")).toBe("eur");
    expect(c.get("items[0][price_data][unit_amount]")).toBe("3000");
    expect(c.get("items[0][price_data][recurring][interval]")).toBe("month");
    expect(c.get("items[0][price_data][recurring][interval_count]")).toBe("3");
    expect(c.get("payment_settings[payment_method_types][0]")).toBe("card");
    expect(c.get("payment_settings[payment_method_types][1]")).toBeNull();
    expect(c.get("payment_behavior")).toBe("default_incomplete");
    expect(c.get("metadata[user_id]")).toBe("user-1");
    expect(c.get("trial_end")).toBeNull();
  });

  it("teste correndo: trial_end = fim do teste, nada hoje, SetupIntent", async () => {
    const em = new Date("2026-10-15T10:00:00Z");
    const { stripe, chamadas } = stripeSimulado([
      { id: "sub_2", pending_setup_intent: { client_secret: "seti_2_secret" } },
    ]);
    const r = await criarAssinatura(stripe, {
      cliente: "cus_1",
      produto: "prod_1",
      plano: planoPorId("1m"),
      userId: "user-1",
      cenario: { tipo: "fimDoTeste", em },
    });
    expect(r).toEqual({
      tipo: "setup",
      clientSecret: "seti_2_secret",
      assinaturaId: "sub_2",
    });
    expect(chamadas[0].corpo.get("trial_end")).toBe(
      String(em.getTime() / 1000)
    );
    expect(chamadas[0].corpo.get("items[0][price_data][unit_amount]")).toBe(
      "1500"
    );
  });

  it("Stripe sem o client_secret esperado: erro (nunca segue sem formulário)", async () => {
    const { stripe } = stripeSimulado([{ id: "sub_3", latest_invoice: {} }]);
    await expect(
      criarAssinatura(stripe, {
        cliente: "c",
        produto: "p",
        plano: planoPorId("2m"),
        userId: "u",
        cenario: { tipo: "agora" },
      })
    ).rejects.toBeInstanceOf(ErroDoStripe);
  });
});
