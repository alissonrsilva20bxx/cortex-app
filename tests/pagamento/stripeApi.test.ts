import { describe, expect, it } from "vitest";
import {
  ErroDoStripe,
  ErroJaAtiva,
  VERSAO_DA_API_STRIPE,
  prepararAssinatura,
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
    // idempotente: duas aberturas seguidas não criam duas clientes
    expect(
      (b.chamadas[1].init.headers as Record<string, string>)["Idempotency-Key"]
    ).toBe("jobapp-cliente-user-1");
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
    expect(
      c.get("trial_settings[end_behavior][missing_payment_method]")
    ).toBeNull();
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
    // Teste acabou sem cartão: o Stripe CANCELA (não tenta cobrar).
    expect(
      chamadas[0].corpo.get(
        "trial_settings[end_behavior][missing_payment_method]"
      )
    ).toBe("cancel");
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

describe("uma assinatura por conta (nunca uma nova a cada abertura)", () => {
  const plano3 = planoPorId("3m");
  const base = {
    cliente: "cus_1",
    produto: "prod_1",
    userId: "user-1",
    abertura: "ab-123456789",
  };
  const metodo = (c: { init: RequestInit }) => c.init.method;

  it("já há uma que vale: ErroJaAtiva, sem criar nem cancelar nada", async () => {
    const { stripe, chamadas } = stripeSimulado([
      {
        data: [{ id: "sub_v", status: "active", default_payment_method: "pm" }],
      },
    ]);
    await expect(
      prepararAssinatura(stripe, {
        ...base,
        plano: plano3,
        cenario: { tipo: "agora" },
      })
    ).rejects.toBeInstanceOf(ErroJaAtiva);
    expect(chamadas.map(metodo)).toEqual(["GET"]);
  });

  it("aberta do MESMO plano e cenário: reaproveita o mesmo formulário", async () => {
    const { stripe, chamadas } = stripeSimulado([
      {
        data: [
          {
            id: "sub_a",
            status: "incomplete",
            metadata: { plano: "3m" },
            latest_invoice: {
              payment_intent: { client_secret: "pi_a_secret" },
            },
          },
        ],
      },
    ]);
    const r = await prepararAssinatura(stripe, {
      ...base,
      plano: plano3,
      cenario: { tipo: "agora" },
    });
    expect(r).toEqual({
      tipo: "payment",
      clientSecret: "pi_a_secret",
      assinaturaId: "sub_a",
    });
    expect(chamadas.map(metodo)).toEqual(["GET"]);
  });

  it("no teste: reaproveita a trialing sem cartão do mesmo plano (SetupIntent)", async () => {
    const { stripe } = stripeSimulado([
      {
        data: [
          {
            id: "sub_t",
            status: "trialing",
            metadata: { plano: "3m" },
            pending_setup_intent: { client_secret: "seti_t_secret" },
          },
        ],
      },
    ]);
    const r = await prepararAssinatura(stripe, {
      ...base,
      plano: plano3,
      cenario: { tipo: "fimDoTeste", em: new Date("2026-10-15T10:00:00Z") },
    });
    expect(r).toEqual({
      tipo: "setup",
      clientSecret: "seti_t_secret",
      assinaturaId: "sub_t",
    });
  });

  it("abertas de OUTRO plano: cancela todas e cria a nova, com a chave da abertura", async () => {
    const { stripe, chamadas } = stripeSimulado([
      {
        data: [
          {
            id: "sub_x",
            status: "incomplete",
            metadata: { plano: "1m" },
            // tem formulário pronto: só não pode ser reaproveitada por ser
            // de OUTRO plano
            latest_invoice: { payment_intent: { client_secret: "pi_x" } },
          },
          { id: "sub_y", status: "trialing", metadata: { plano: "2m" } },
          { id: "sub_velha", status: "canceled", metadata: { plano: "3m" } },
        ],
      },
      {},
      {},
      {
        id: "sub_nova",
        latest_invoice: { payment_intent: { client_secret: "pi_n" } },
      },
    ]);
    const r = await prepararAssinatura(stripe, {
      ...base,
      plano: plano3,
      cenario: { tipo: "agora" },
    });
    expect(r.assinaturaId).toBe("sub_nova");
    expect(chamadas.map((c) => `${metodo(c)} ${c.url.split("?")[0]}`)).toEqual([
      "GET https://api.stripe.com/v1/subscriptions",
      "DELETE https://api.stripe.com/v1/subscriptions/sub_x",
      "DELETE https://api.stripe.com/v1/subscriptions/sub_y",
      "POST https://api.stripe.com/v1/subscriptions",
    ]);
    const criar = chamadas[3];
    expect(
      (criar.init.headers as Record<string, string>)["Idempotency-Key"]
    ).toBe("jobapp-assinatura-user-1-ab-123456789");
    expect(criar.corpo.get("metadata[abertura]")).toBe("ab-123456789");
  });

  it("aberta do mesmo plano mas no cenário errado (teste x hoje): cancela e cria", async () => {
    const { stripe, chamadas } = stripeSimulado([
      {
        data: [
          {
            id: "sub_t",
            status: "trialing",
            metadata: { plano: "3m" },
            pending_setup_intent: { client_secret: "seti" },
          },
        ],
      },
      {},
      {
        id: "sub_n",
        latest_invoice: { payment_intent: { client_secret: "pi" } },
      },
    ]);
    await prepararAssinatura(stripe, {
      ...base,
      plano: plano3,
      cenario: { tipo: "agora" },
    });
    expect(chamadas.map(metodo)).toEqual(["GET", "DELETE", "POST"]);
  });
});
