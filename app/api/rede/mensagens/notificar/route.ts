import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";

import { createClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  PUSH_MENSAGEM_CORPO,
  PUSH_MENSAGEM_TITULO,
} from "../../../../../lib/rede/pushMensagem";

export const runtime = "nodejs";

/**
 * Dispara push de mensagem nova (ticket 06 do mapa) -- caminho orientado a
 * evento, separado do envio da mensagem em si (`enviarMensagem` em
 * lib/rede/mensagens.ts, já testado, continua inserindo direto via RLS).
 * O cliente chama esta rota logo depois de enviar com sucesso; falha aqui
 * nunca deveria derrubar o envio da mensagem, só o push fica sem sair.
 *
 * Privacidade (ordem do capitão, 2026-10-20): a notificação aparece na tela
 * bloqueada do celular, à vista de quem estiver perto. Por isso ela NÃO
 * leva o texto da mensagem nem o nome de quem mandou: o título é sempre
 * "Nova mensagem" e o corpo é genérico. O cliente nem manda mais o texto
 * pra cá; se mandar (versão antiga em cache), ele é ignorado.
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

  const { conversaId } = recebido as { conversaId?: unknown };
  if (typeof conversaId !== "string" || !conversaId) {
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

  // RLS de rede_conversas_participantes só deixa ver linhas de conversas
  // onde a chamadora participa -- se ela não for participante, esta query
  // já devolve vazio, então a checagem abaixo é sempre correta.
  const { data: participantes, error: participantesError } = await supabase
    .from("rede_conversas_participantes")
    .select("user_id")
    .eq("conversa_id", conversaId);

  if (participantesError) {
    return NextResponse.json(
      { error: "Não foi possível notificar" },
      { status: 500 }
    );
  }

  const souParticipante = (participantes ?? []).some(
    (p) => p.user_id === user.id
  );
  if (!souParticipante) {
    return NextResponse.json(
      { error: "Sem acesso à conversa" },
      { status: 403 }
    );
  }

  const destinatarios = (participantes ?? [])
    .map((p) => p.user_id)
    .filter((id) => id !== user.id);

  if (destinatarios.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: subs, error: subsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", destinatarios);

  // Erro real de banco não é "ninguém inscrito" -- tratar os dois igual
  // escondia falhas de infraestrutura atrás de um `sent: 0` silencioso.
  if (subsError) {
    console.error("[notificar mensagem] falha ao buscar inscrições", subsError);
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
    console.error("[notificar mensagem] VAPID keys não configuradas");
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

  // Sem nome e sem trecho: só o aviso neutro (ver o comentário do topo).
  const payload = JSON.stringify({
    title: PUSH_MENSAGEM_TITULO,
    body: PUSH_MENSAGEM_CORPO,
    tag: `rede-mensagem-${conversaId}`,
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
            "[notificar mensagem] falha ao remover inscrição expirada",
            deleteError
          );
        }
      } else {
        console.error("[notificar mensagem] falha ao enviar push", err);
      }
    }
  }

  return NextResponse.json({ sent });
}
