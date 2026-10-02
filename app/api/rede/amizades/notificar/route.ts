import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import {
  enviarPushPara,
  eventoRecente,
  nomeExibicao,
} from "../../../../../lib/rede/pushEnvio";
import { createClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Push de pedido de amizade -- mesmo desenho de `mensagens/notificar`: o
 * cliente chama logo depois de enviar/aceitar com sucesso (fire-and-forget)
 * e falha aqui nunca derruba a ação em si.
 *
 * O servidor não confia no que o cliente diz que aconteceu: lê a linha de
 * `rede_amizades` com a sessão da chamadora (RLS só mostra linhas onde ela
 * é uma das pontas) e decide pelo estado real:
 *   - pendente e ela é quem pediu  → avisa a destinatária ("quer ser sua amiga");
 *   - aceita e ela é quem aceitou  → avisa quem pediu ("aceitou seu pedido").
 * Qualquer outra combinação, ou evento fora da janela, não notifica ninguém.
 */
export async function POST(request: NextRequest) {
  let recebido: unknown;
  try {
    recebido = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (
    recebido === null ||
    typeof recebido !== "object" ||
    Array.isArray(recebido)
  ) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { amizadeId } = recebido as { amizadeId?: unknown };
  if (typeof amizadeId !== "string" || amizadeId.length === 0) {
    return NextResponse.json(
      { error: "Parâmetros inválidos" },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: amizade, error: amizadeError } = await supabase
    .from("rede_amizades")
    .select("solicitante_id, destinatario_id, status, criado_em, respondido_em")
    .eq("id", amizadeId)
    .maybeSingle();

  if (amizadeError) {
    return NextResponse.json(
      { error: "Não foi possível notificar" },
      { status: 500 }
    );
  }

  if (!amizade) {
    return NextResponse.json(
      { error: "Pedido não encontrado" },
      { status: 404 }
    );
  }

  let destinatarioId: string;
  let quando: string | null;
  let titulo: string;
  let corpo: string;
  if (amizade.status === "pendente" && amizade.solicitante_id === user.id) {
    destinatarioId = amizade.destinatario_id;
    quando = amizade.criado_em;
    titulo = "Pedido de amizade";
    corpo = "quer ser sua amiga na Rede.";
  } else if (
    amizade.status === "aceita" &&
    amizade.destinatario_id === user.id
  ) {
    destinatarioId = amizade.solicitante_id;
    quando = amizade.respondido_em;
    titulo = "Nova amiga";
    corpo = "aceitou seu pedido de amizade.";
  } else {
    return NextResponse.json({ sent: 0 });
  }

  if (!eventoRecente(quando)) {
    return NextResponse.json({ sent: 0 });
  }

  const admin = getSupabaseAdmin();
  const nome = await nomeExibicao(admin, user.id);
  const resultado = await enviarPushPara(
    admin,
    [destinatarioId],
    {
      title: titulo,
      body: `${nome} ${corpo}`,
      // Uma notificação por pedido: reenviar/aceitar substitui, não empilha.
      tag: `rede-amizade-${amizadeId}`,
    },
    "notificar amizade"
  );

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.status }
    );
  }
  return NextResponse.json({ sent: resultado.sent });
}
