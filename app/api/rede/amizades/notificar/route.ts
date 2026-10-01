import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";

import { createClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Janela em que o evento ainda conta como "acabou de acontecer". Sem ela,
 * a chamadora poderia repetir a rota com um pedido antigo e martelar a
 * outra pessoa de push.
 */
export const JANELA_NOTIFICAR_MS = 5 * 60 * 1000;

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
 * Qualquer outra combinação não notifica ninguém.
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
  let corpo: string;
  if (amizade.status === "pendente" && amizade.solicitante_id === user.id) {
    destinatarioId = amizade.destinatario_id;
    quando = amizade.criado_em;
    corpo = "quer ser sua amiga na Rede.";
  } else if (
    amizade.status === "aceita" &&
    amizade.destinatario_id === user.id
  ) {
    destinatarioId = amizade.solicitante_id;
    quando = amizade.respondido_em;
    corpo = "aceitou seu pedido de amizade.";
  } else {
    return NextResponse.json({ sent: 0 });
  }

  const instante = quando ? Date.parse(quando) : NaN;
  if (
    !Number.isFinite(instante) ||
    Date.now() - instante > JANELA_NOTIFICAR_MS
  ) {
    return NextResponse.json({ sent: 0 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: perfil }, { data: subs, error: subsError }] =
    await Promise.all([
      supabaseAdmin
        .from("rede_perfis")
        .select("nome_exibicao")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .in("user_id", [destinatarioId]),
    ]);

  if (subsError) {
    console.error("[notificar amizade] falha ao buscar inscrições", subsError);
    return NextResponse.json(
      { error: "Não foi possível notificar" },
      { status: 500 }
    );
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("[notificar amizade] VAPID keys não configuradas");
    return NextResponse.json(
      { error: "Push não configurado" },
      { status: 500 }
    );
  }

  webpush.setVapidDetails(
    "mailto:suporte@jobapp.app",
    vapidPublicKey,
    vapidPrivateKey
  );

  const nome = perfil?.nome_exibicao?.trim() || "Alguém";
  const payload = JSON.stringify({
    title: amizade.status === "pendente" ? "Pedido de amizade" : "Nova amiga",
    body: `${nome} ${corpo}`,
    // Uma notificação por pedido: reenviar/aceitar de novo substitui, não empilha.
    tag: `rede-amizade-${amizadeId}`,
    url: "/",
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        const { error: deleteError } = await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("id", sub.id);
        if (deleteError) {
          console.error(
            "[notificar amizade] falha ao remover inscrição expirada",
            deleteError
          );
        }
      } else {
        console.error("[notificar amizade] falha ao enviar push", err);
      }
    }
  }

  return NextResponse.json({ sent });
}
