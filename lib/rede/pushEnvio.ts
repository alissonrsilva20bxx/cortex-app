import "server-only";

import webpush from "web-push";

import type { getSupabaseAdmin } from "../supabaseAdmin";

type Admin = ReturnType<typeof getSupabaseAdmin>;

export type PushPayload = {
  title: string;
  body: string;
  /** Mesma tag substitui a notificação anterior em vez de empilhar. */
  tag: string;
  url?: string;
};

export type ResultadoPush =
  | { ok: true; sent: number }
  | { ok: false; status: 500; error: string };

/**
 * Janela em que um evento social (pedido, curtida, comentário) ainda conta
 * como "acabou de acontecer". Sem ela, dava pra repetir a rota com um
 * evento antigo e martelar a outra pessoa de push.
 */
export const JANELA_NOTIFICAR_MS = 5 * 60 * 1000;

export function eventoRecente(quando: string | null | undefined): boolean {
  const t = quando ? Date.parse(quando) : NaN;
  return Number.isFinite(t) && Date.now() - t <= JANELA_NOTIFICAR_MS;
}

/** Nome de quem fez a ação, pro título/corpo da notificação. */
export async function nomeExibicao(admin: Admin, userId: string) {
  const { data } = await admin
    .from("rede_perfis")
    .select("nome_exibicao")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.nome_exibicao?.trim() || "Alguém";
}

/**
 * Envia o push pra todas as inscrições de `userIds` e limpa as expiradas
 * (404/410). Mesmo comportamento de `mensagens/notificar`: erro real de
 * banco ou VAPID ausente vira 500, nunca um `sent: 0` silencioso.
 */
export async function enviarPushPara(
  admin: Admin,
  userIds: string[],
  payload: PushPayload,
  logTag: string
): Promise<ResultadoPush> {
  if (userIds.length === 0) return { ok: true, sent: 0 };

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subsError) {
    console.error(`[${logTag}] falha ao buscar inscrições`, subsError);
    return { ok: false, status: 500, error: "Não foi possível notificar" };
  }

  if (!subs || subs.length === 0) return { ok: true, sent: 0 };

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error(`[${logTag}] VAPID keys não configuradas`);
    return { ok: false, status: 500, error: "Push não configurado" };
  }

  webpush.setVapidDetails(
    "mailto:suporte@jobapp.app",
    vapidPublicKey,
    vapidPrivateKey
  );

  const corpo = JSON.stringify({ url: "/", ...payload });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        corpo
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        const { error: deleteError } = await admin
          .from("push_subscriptions")
          .delete()
          .eq("id", sub.id);
        if (deleteError) {
          console.error(
            `[${logTag}] falha ao remover inscrição expirada`,
            deleteError
          );
        }
      } else {
        console.error(`[${logTag}] falha ao enviar push`, err);
      }
    }
  }

  return { ok: true, sent };
}
