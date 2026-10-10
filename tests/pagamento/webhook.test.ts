import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  assinarComoStripe,
  atualizacaoDoEvento,
  verificarAssinaturaDoStripe,
} from "@/lib/pagamento/webhook";

/**
 * Webhook do Stripe com um Stripe SIMULADO: o teste assina o evento com o
 * segredo do endpoint exatamente como o Stripe faz (HMAC-SHA256 de
 * "<t>.<corpo>") e manda para a rota de verdade
 * (app/api/pagamento/webhook/route.ts). O Supabase (service role) é falso e
 * registra o que a rota escreveu.
 */

const SEGREDO = "whsec_teste_123";
const agora = () => Math.floor(Date.now() / 1000);
const cabecalho = (corpo: string, t = agora(), segredo = SEGREDO) =>
  `t=${t},v1=${assinarComoStripe(corpo, t, segredo)}`;

const evento = (
  type: string,
  status: string | null,
  metadata: Record<string, string> = { user_id: "user-1", plano: "3m" },
  extra: Record<string, unknown> = {}
) =>
  JSON.stringify({
    id: "evt_1",
    type,
    data: {
      object: {
        id: "sub_1",
        object: "subscription",
        customer: "cus_1",
        status,
        metadata,
        ...extra,
      },
    },
  });

describe("verificação da assinatura do Stripe", () => {
  const corpo = evento("customer.subscription.updated", "active");

  it("o esquema do Stripe, calculado à parte: v1 = HMAC-SHA256(segredo, '<t>.<corpo>')", () => {
    const t = agora();
    const v1 = createHmac("sha256", SEGREDO)
      .update(`${t}.${corpo}`)
      .digest("hex");
    expect(
      verificarAssinaturaDoStripe(corpo, `t=${t},v1=${v1}`, SEGREDO)
    ).toEqual({ ok: true });
    // assinar só o corpo (sem o carimbo) não vale
    const soCorpo = createHmac("sha256", SEGREDO).update(corpo).digest("hex");
    expect(
      verificarAssinaturaDoStripe(corpo, `t=${t},v1=${soCorpo}`, SEGREDO).ok
    ).toBe(false);
  });

  it("assinatura certa e recente: vale", () => {
    expect(
      verificarAssinaturaDoStripe(corpo, cabecalho(corpo), SEGREDO)
    ).toEqual({ ok: true });
  });

  it("corpo alterado depois de assinado: não confere", () => {
    const h = cabecalho(corpo);
    expect(
      verificarAssinaturaDoStripe(
        corpo.replace("active", "trialing"),
        h,
        SEGREDO
      )
    ).toEqual({ ok: false, motivo: "nao-confere" });
  });

  it("assinado com outro segredo: não confere", () => {
    expect(
      verificarAssinaturaDoStripe(
        corpo,
        cabecalho(corpo, agora(), "whsec_outro"),
        SEGREDO
      )
    ).toEqual({ ok: false, motivo: "nao-confere" });
  });

  it("mais de 5 minutos (reenvio de um evento velho): recusado", () => {
    const t = agora() - 301;
    expect(
      verificarAssinaturaDoStripe(corpo, cabecalho(corpo, t), SEGREDO)
    ).toEqual({
      ok: false,
      motivo: "fora-do-prazo",
    });
    expect(
      verificarAssinaturaDoStripe(
        corpo,
        cabecalho(corpo, agora() - 299),
        SEGREDO
      )
    ).toEqual({ ok: true });
  });

  it("carimbo no FUTURO (mais de 5 min à frente): recusado", () => {
    expect(
      verificarAssinaturaDoStripe(
        corpo,
        cabecalho(corpo, agora() + 600),
        SEGREDO
      )
    ).toEqual({ ok: false, motivo: "fora-do-prazo" });
  });

  it("sem cabeçalho ou malformado: recusado", () => {
    expect(verificarAssinaturaDoStripe(corpo, null, SEGREDO).ok).toBe(false);
    expect(verificarAssinaturaDoStripe(corpo, "lixo", SEGREDO)).toEqual({
      ok: false,
      motivo: "malformado",
    });
    expect(verificarAssinaturaDoStripe(corpo, `t=${agora()}`, SEGREDO)).toEqual(
      { ok: false, motivo: "malformado" }
    );
  });

  it("vários v1 (troca de segredo no Stripe): vale se algum confere", () => {
    const t = agora();
    const h = `t=${t},v1=${"0".repeat(64)},v1=${assinarComoStripe(corpo, t, SEGREDO)}`;
    expect(verificarAssinaturaDoStripe(corpo, h, SEGREDO)).toEqual({
      ok: true,
    });
  });
});

describe("o que cada evento muda", () => {
  const ev = (s: string) => JSON.parse(s);
  const COM_CARTAO = { default_payment_method: "pm_1" };

  it("paga (active/past_due): 'ativa' para a conta do metadata", () => {
    expect(
      atualizacaoDoEvento(ev(evento("customer.subscription.updated", "active")))
    ).toEqual({ userId: "user-1", assinaturaStatus: "ativa" });
    expect(
      atualizacaoDoEvento(
        ev(evento("customer.subscription.updated", "past_due"))
      )
    ).toEqual({ userId: "user-1", assinaturaStatus: "ativa" });
  });

  it("no teste COM cartão: 'ativa'", () => {
    expect(
      atualizacaoDoEvento(
        ev(
          evento(
            "customer.subscription.updated",
            "trialing",
            undefined,
            COM_CARTAO
          )
        )
      )
    ).toEqual({ userId: "user-1", assinaturaStatus: "ativa" });
  });

  it("no teste SEM cartão (só abriu o Pagamento): nada muda", () => {
    expect(
      atualizacaoDoEvento(
        ev(evento("customer.subscription.created", "trialing"))
      )
    ).toBeNull();
  });

  it("cancelada, sem pagamento ou apagada, sem outra que valha: volta a 'trial'", () => {
    for (const [tipo, st] of [
      ["customer.subscription.updated", "canceled"],
      ["customer.subscription.updated", "unpaid"],
      ["customer.subscription.deleted", "active"],
    ])
      expect(atualizacaoDoEvento(ev(evento(tipo, st)))).toEqual({
        userId: "user-1",
        assinaturaStatus: "trial",
      });
  });

  it("incompleta ou expirada sem pagar: nada muda (nunca deu 'ativa')", () => {
    expect(
      atualizacaoDoEvento(
        ev(evento("customer.subscription.created", "incomplete"))
      )
    ).toBeNull();
    expect(
      atualizacaoDoEvento(
        ev(evento("customer.subscription.updated", "incomplete_expired"))
      )
    ).toBeNull();
  });

  // Duas assinaturas da mesma conta: a velha que expira ou é cancelada não
  // rebaixa quem pagou na outra.
  it("A (velha) expira ou é cancelada enquanto B está paga: continua 'ativa'", () => {
    const daCliente = [
      { id: "sub_1", status: "incomplete_expired" },
      { id: "sub_2", status: "active", default_payment_method: "pm_2" },
    ];
    for (const st of ["incomplete_expired", "canceled"])
      expect(
        atualizacaoDoEvento(
          ev(evento("customer.subscription.updated", st)),
          daCliente
        )
      ).toEqual({ userId: "user-1", assinaturaStatus: "ativa" });
    expect(
      atualizacaoDoEvento(
        ev(evento("customer.subscription.deleted", "canceled")),
        daCliente
      )
    ).toEqual({ userId: "user-1", assinaturaStatus: "ativa" });
  });

  it("A cancelada e B no teste SEM cartão: B não sustenta, volta a 'trial'", () => {
    const daCliente = [{ id: "sub_2", status: "trialing" }];
    expect(
      atualizacaoDoEvento(
        ev(evento("customer.subscription.updated", "canceled")),
        daCliente
      )
    ).toEqual({ userId: "user-1", assinaturaStatus: "trial" });
  });

  it("a foto da listagem vale mais que o objeto do evento (mesmo id)", () => {
    // O evento chegou atrasado dizendo "active", mas a assinatura já foi
    // cancelada no Stripe: não pode voltar a "ativa".
    expect(
      atualizacaoDoEvento(
        ev(evento("customer.subscription.updated", "active")),
        [{ id: "sub_1", status: "canceled" }]
      )
    ).toBeNull();
  });

  it("outro evento, ou sem dona (user_id ausente, vazio ou só espaço): nada muda", () => {
    expect(
      atualizacaoDoEvento(ev(evento("invoice.paid", "active")))
    ).toBeNull();
    for (const metadata of [{}, { user_id: "" }, { user_id: "   " }] as Record<
      string,
      string
    >[])
      expect(
        atualizacaoDoEvento(
          ev(evento("customer.subscription.updated", "active", metadata))
        )
      ).toBeNull();
  });
});

// ── A rota, de ponta a ponta, com o Stripe simulado ─────────────────────
const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: (tabela: string) => ({
      update: (valores: Record<string, unknown>) => {
        mocks.update(tabela, valores);
        return {
          eq: async (coluna: string, valor: string) => {
            mocks.eq(coluna, valor);
            return { error: null };
          },
        };
      },
    }),
  }),
}));

import { POST } from "../../app/api/pagamento/webhook/route";
import { NextRequest } from "next/server";

const chamar = (corpo: string, assinatura: string | null) =>
  POST(
    new NextRequest("http://localhost/api/pagamento/webhook", {
      method: "POST",
      body: corpo,
      headers: assinatura ? { "stripe-signature": assinatura } : {},
    })
  );

describe("rota do webhook (Stripe simulado)", () => {
  beforeEach(() => {
    mocks.update.mockClear();
    mocks.eq.mockClear();
    process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
  });

  it("evento assinado pelo Stripe: grava a assinatura da conta com a service role", async () => {
    const corpo = evento("customer.subscription.updated", "active");
    const r = await chamar(corpo, cabecalho(corpo));
    expect(r.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("configuracoes", {
      assinatura_status: "ativa",
    });
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("assinatura falsa: 400 e nada é gravado", async () => {
    const corpo = evento("customer.subscription.updated", "active");
    const r = await chamar(
      corpo,
      cabecalho(corpo, agora(), "whsec_de_quem_tenta")
    );
    expect(r.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("sem cabeçalho do Stripe: 400 e nada é gravado", async () => {
    const corpo = evento("customer.subscription.updated", "active");
    const r = await chamar(corpo, null);
    expect(r.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("sem STRIPE_WEBHOOK_SECRET: 503 e nada é gravado", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const corpo = evento("customer.subscription.updated", "active");
    const r = await chamar(corpo, cabecalho(corpo));
    expect(r.status).toBe(503);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("evento que não muda nada: 200 (o Stripe não reenvia) e nada é gravado", async () => {
    const corpo = evento("invoice.paid", "active");
    const r = await chamar(corpo, cabecalho(corpo));
    expect(r.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("duas assinaturas da mesma conta: a velha expira e a conta segue 'ativa' (lista o Stripe)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    const pedidos: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        pedidos.push(url);
        return new Response(
          JSON.stringify({
            data: [
              { id: "sub_1", status: "incomplete_expired" },
              { id: "sub_2", status: "active", default_payment_method: "pm_2" },
            ],
          }),
          { status: 200 }
        );
      })
    );
    const corpo = evento("customer.subscription.updated", "incomplete_expired");
    const r = await chamar(corpo, cabecalho(corpo));
    expect(r.status).toBe(200);
    expect(decodeURIComponent(pedidos[0])).toContain(
      "subscriptions?customer=cus_1"
    );
    expect(decodeURIComponent(pedidos[0])).toContain("status=all");
    expect(mocks.update).toHaveBeenCalledWith("configuracoes", {
      assinatura_status: "ativa",
    });
    expect(mocks.update).not.toHaveBeenCalledWith("configuracoes", {
      assinatura_status: "trial",
    });
    vi.unstubAllGlobals();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("Stripe não responde a listagem: 500 (o Stripe reenvia) e nada é gravado", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 }))
    );
    const corpo = evento("customer.subscription.updated", "canceled");
    const r = await chamar(corpo, cabecalho(corpo));
    expect(r.status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    delete process.env.STRIPE_SECRET_KEY;
  });
});
