import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * app/api/pagamento/assinatura, de ponta a ponta com o Stripe SIMULADO no
 * `fetch`: sem chave dá "indisponível"; o teste correndo é lido do banco da
 * própria conta (não do que o aparelho manda); o plano vira centavos de
 * euro; só cartão.
 */

const mocks = vi.hoisted(() => ({
  resolveGateAuth: vi.fn(),
  config: {
    trial_started_at: null as string | null,
    assinatura_status: "trial",
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/devPreview/serverAuth", () => ({
  resolveGateAuth: mocks.resolveGateAuth,
}));

import { POST } from "../../app/api/pagamento/assinatura/route";
import { NextRequest } from "next/server";

const supabaseFalso = {
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: mocks.config }) }),
    }),
  }),
  auth: { getUser: async () => ({ data: { user: { email: "a@b.c" } } }) },
};

let chamadasStripe: {
  url: string;
  metodo: string;
  corpo: URLSearchParams;
  idem?: string;
}[] = [];
let assinaturasExistentes: Record<string, unknown>[] = [];
function stripeNoFetch() {
  chamadasStripe = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const corpo = new URLSearchParams(String(init.body ?? ""));
      const h = (init.headers ?? {}) as Record<string, string>;
      chamadasStripe.push({
        url,
        metodo: String(init.method),
        corpo,
        idem: h["Idempotency-Key"],
      });
      const resp = url.includes("customers/search")
        ? { data: [{ id: "cus_1" }] }
        : url.includes("products/search")
          ? { data: [{ id: "prod_1" }] }
          : init.method === "GET" && url.includes("/v1/subscriptions")
            ? { data: assinaturasExistentes }
            : init.method === "DELETE"
              ? { id: url.split("/").pop(), status: "canceled" }
              : corpo.get("trial_end")
                ? {
                    id: "sub_1",
                    pending_setup_intent: { client_secret: "seti_secret" },
                  }
                : {
                    id: "sub_1",
                    latest_invoice: {
                      payment_intent: { client_secret: "pi_secret" },
                    },
                  };
      return new Response(JSON.stringify(resp), { status: 200 });
    })
  );
}

const pedir = (corpo: unknown) =>
  POST(
    new NextRequest("http://localhost/api/pagamento/assinatura", {
      method: "POST",
      body: JSON.stringify(corpo),
    })
  );
const assinaturaCriada = () =>
  chamadasStripe.find(
    (c) => c.metodo === "POST" && c.url.endsWith("/v1/subscriptions")
  );

describe("rota de assinatura (Stripe simulado)", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    mocks.resolveGateAuth.mockResolvedValue({
      kind: "authenticated",
      supabase: supabaseFalso,
      userId: "user-1",
    });
    mocks.config = { trial_started_at: null, assinatura_status: "trial" };
    assinaturasExistentes = [];
    stripeNoFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sem STRIPE_SECRET_KEY: 503 'indisponível', sem chamar o Stripe nem olhar a sessão", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const r = await pedir({ plano: "3m" });
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ indisponivel: true });
    expect(chamadasStripe).toHaveLength(0);
    expect(mocks.resolveGateAuth).not.toHaveBeenCalled();
  });

  it("sem sessão: 401", async () => {
    mocks.resolveGateAuth.mockResolvedValue({ kind: "unauthenticated" });
    expect((await pedir({ plano: "3m" })).status).toBe(401);
    expect(chamadasStripe).toHaveLength(0);
  });

  it("plano que não existe: 400", async () => {
    expect((await pedir({ plano: "12m" })).status).toBe(400);
    expect(chamadasStripe).toHaveLength(0);
  });

  it("já ativa: 409, sem criar outra assinatura", async () => {
    mocks.config = { trial_started_at: null, assinatura_status: "ativa" };
    expect((await pedir({ plano: "3m" })).status).toBe(409);
    expect(assinaturaCriada()).toBeUndefined();
  });

  it("teste acabou: cobra hoje € 30 (3 meses), só cartão, PaymentIntent", async () => {
    mocks.config = {
      trial_started_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      assinatura_status: "trial",
    };
    const r = await pedir({ plano: "3m" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      tipo: "payment",
      clientSecret: "pi_secret",
      cobrancaEm: null,
    });
    const c = assinaturaCriada()!.corpo;
    expect(c.get("items[0][price_data][unit_amount]")).toBe("3000");
    expect(c.get("items[0][price_data][currency]")).toBe("eur");
    expect(c.get("payment_settings[payment_method_types][0]")).toBe("card");
    expect(c.get("trial_end")).toBeNull();
    expect(c.get("metadata[user_id]")).toBe("user-1");
  });

  it("teste correndo (lido do banco): nada hoje, cobrança no fim do teste, SetupIntent", async () => {
    mocks.config = {
      trial_started_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      assinatura_status: "trial",
    };
    const r = await pedir({ plano: "1m" });
    const json = await r.json();
    expect(json).toMatchObject({ tipo: "setup", clientSecret: "seti_secret" });
    expect(typeof json.cobrancaEm).toBe("string");
    expect(assinaturaCriada()!.corpo.get("trial_end")).not.toBeNull();
  });

  it("o aparelho não escolhe o cenário: mandar 'trial_end'/'cobrancaEm' no corpo não muda nada", async () => {
    mocks.config = {
      trial_started_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      assinatura_status: "trial",
    };
    await pedir({
      plano: "3m",
      trial_end: 9_999_999_999,
      cobrancaEm: "2099-01-01",
    });
    expect(assinaturaCriada()!.corpo.get("trial_end")).toBeNull();
  });

  it("Stripe fora do ar: 502 com mensagem para a tela", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "x" } }), {
            status: 500,
          })
      )
    );
    const r = await pedir({ plano: "3m" });
    expect(r.status).toBe(502);
    expect((await r.json()).error).toMatch(/Não foi possível/);
  });

  it("abrir de novo o mesmo plano reaproveita a assinatura aberta (não cria outra)", async () => {
    mocks.config = {
      trial_started_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      assinatura_status: "trial",
    };
    assinaturasExistentes = [
      {
        id: "sub_aberta",
        status: "incomplete",
        metadata: { plano: "3m" },
        latest_invoice: {
          payment_intent: { client_secret: "pi_reaproveitado" },
        },
      },
    ];
    const r = await pedir({ plano: "3m", abertura: "abertura-0001" });
    expect(await r.json()).toMatchObject({ clientSecret: "pi_reaproveitado" });
    expect(assinaturaCriada()).toBeUndefined();
  });

  it("outro plano: cancela a aberta e cria a nova com a chave de idempotência da abertura", async () => {
    mocks.config = {
      trial_started_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      assinatura_status: "trial",
    };
    assinaturasExistentes = [
      {
        id: "sub_aberta",
        status: "incomplete",
        metadata: { plano: "1m" },
        latest_invoice: { payment_intent: { client_secret: "pi_outro_plano" } },
      },
    ];
    await pedir({ plano: "3m", abertura: "abertura-0002" });
    expect(
      chamadasStripe.some(
        (c) => c.metodo === "DELETE" && c.url.endsWith("/sub_aberta")
      )
    ).toBe(true);
    expect(assinaturaCriada()!.idem).toBe(
      "jobapp-assinatura-user-1-abertura-0002"
    );
  });

  it("já paga no Stripe (mesmo com o banco ainda em 'trial'): 409, sem criar", async () => {
    assinaturasExistentes = [
      { id: "sub_v", status: "active", default_payment_method: "pm" },
    ];
    const r = await pedir({ plano: "3m" });
    expect(r.status).toBe(409);
    expect(assinaturaCriada()).toBeUndefined();
  });

  it("abertura inválida vinda do aparelho é trocada por uma do servidor", async () => {
    await pedir({ plano: "3m", abertura: "x'; drop" });
    expect(assinaturaCriada()!.idem).toMatch(
      /^jobapp-assinatura-user-1-[0-9a-f-]{36}$/
    );
  });
});
