import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { resolveGateAuth } from "../../../../lib/devPreview/serverAuth";
import { PLANOS, type PlanoId } from "../../../../lib/planos";
import { cenarioDaCobranca } from "../../../../lib/pagamento/regras";
import {
  ErroDoStripe,
  clienteDaConta,
  criarAssinatura,
  criarClienteStripe,
  produtoDoApp,
} from "../../../../lib/pagamento/stripeApi";

export const runtime = "nodejs";

/**
 * Cria a assinatura do plano no Stripe e devolve o `client_secret` que o
 * Payment Element usa no aparelho (o cartão vai direto do aparelho para o
 * Stripe; este servidor nunca vê dado de cartão).
 *
 * - Sem `STRIPE_SECRET_KEY`: 503 `{ indisponivel: true }` (o operador ainda
 *   não tem as chaves; a tela mostra "pagamento ainda não disponível").
 * - O teste correndo é lido AQUI, de `configuracoes` da própria conta, não
 *   do que o aparelho manda: com teste, nada é cobrado hoje (`trial_end` =
 *   fim do teste, SetupIntent); sem teste, cobra hoje (PaymentIntent).
 */
export async function POST(request: NextRequest) {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) {
    return NextResponse.json(
      { indisponivel: true, error: "Pagamento ainda não disponível." },
      { status: 503 }
    );
  }

  const auth = await resolveGateAuth(request);
  if (auth.kind === "unavailable")
    return NextResponse.json({ error: auth.message }, { status: 503 });
  if (auth.kind === "unauthenticated")
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as {
    plano?: unknown;
  } | null;
  const plano = PLANOS.find((p) => p.id === (corpo?.plano as PlanoId));
  if (!plano)
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 });

  const { supabase, userId } = auth;
  const { data: cfg } = await supabase
    .from("configuracoes")
    .select("trial_started_at, assinatura_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (cfg?.assinatura_status === "ativa")
    return NextResponse.json(
      { error: "Sua assinatura já está ativa." },
      { status: 409 }
    );
  const cenario = cenarioDaCobranca(cfg?.trial_started_at ?? null);

  const { data: quem } = await supabase.auth.getUser();
  try {
    const stripe = criarClienteStripe(chave);
    const cliente = await clienteDaConta(
      stripe,
      userId,
      quem.user?.email ?? null
    );
    const produto = await produtoDoApp(stripe);
    const criada = await criarAssinatura(stripe, {
      cliente,
      produto,
      plano,
      userId,
      cenario,
    });
    return NextResponse.json({
      tipo: criada.tipo,
      clientSecret: criada.clientSecret,
      cobrancaEm:
        cenario.tipo === "fimDoTeste" ? cenario.em.toISOString() : null,
    });
  } catch (e) {
    const status = e instanceof ErroDoStripe ? 502 : 500;
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento agora." },
      { status }
    );
  }
}
