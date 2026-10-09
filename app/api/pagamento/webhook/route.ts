import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  atualizacaoDoEvento,
  clienteDoEvento,
  verificarAssinaturaDoStripe,
} from "../../../../lib/pagamento/webhook";
import {
  assinaturasDaCliente,
  criarClienteStripe,
} from "../../../../lib/pagamento/stripeApi";
import type { AssinaturaDoStripe } from "../../../../lib/pagamento/regras";

export const runtime = "nodejs";

/**
 * Webhook do Stripe: atualiza `configuracoes.assinatura_status` quando a
 * assinatura é criada, muda ou é apagada (lib/pagamento/webhook.ts).
 *
 * - Sem `STRIPE_WEBHOOK_SECRET`: 503 (nada é aceito sem poder conferir).
 * - A assinatura do Stripe (`Stripe-Signature`) é conferida contra o corpo
 *   CRU antes de qualquer coisa: assinatura errada, malformada ou velha
 *   (mais de 5 min) dá 400 e nada muda.
 * - A escrita usa a service role: a coluna é só do servidor (migration
 *   0040, que tira essa coluna do alcance da própria usuária).
 */
export async function POST(request: NextRequest) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo)
    return NextResponse.json(
      { error: "Webhook do Stripe não configurado." },
      { status: 503 }
    );

  const corpo = await request.text();
  const verificacao = verificarAssinaturaDoStripe(
    corpo,
    request.headers.get("stripe-signature"),
    segredo
  );
  if (!verificacao.ok)
    return NextResponse.json(
      { error: `Assinatura do Stripe inválida (${verificacao.motivo}).` },
      { status: 400 }
    );

  let evento: unknown;
  try {
    evento = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const ev = evento as Parameters<typeof atualizacaoDoEvento>[0];
  // A decisão olha TODAS as assinaturas da cliente, listadas agora no
  // Stripe: uma velha que expira ou é cancelada nunca rebaixa quem pagou em
  // outra. Sem a chave secreta, decide só pelo evento. Se a listagem
  // falhar: 500, e o Stripe reenvia (nunca grava um palpite).
  let daCliente: AssinaturaDoStripe[] = [];
  const chave = process.env.STRIPE_SECRET_KEY;
  const cliente = clienteDoEvento(ev);
  if (chave && cliente) {
    try {
      daCliente = await assinaturasDaCliente(
        criarClienteStripe(chave),
        cliente
      );
    } catch {
      return NextResponse.json(
        { error: "Não foi possível consultar o Stripe." },
        { status: 500 }
      );
    }
  }
  const atualizacao = atualizacaoDoEvento(ev, daCliente);
  // Evento que não muda nada: 200, para o Stripe não reenviar.
  if (!atualizacao) return NextResponse.json({ recebido: true });

  const { error } = await getSupabaseAdmin()
    .from("configuracoes")
    .update({ assinatura_status: atualizacao.assinaturaStatus })
    .eq("user_id", atualizacao.userId);
  // Falha ao gravar: 500, e o Stripe reenvia depois.
  if (error)
    return NextResponse.json(
      { error: "Não foi possível atualizar a assinatura." },
      { status: 500 }
    );
  return NextResponse.json({ recebido: true, ...atualizacao });
}
