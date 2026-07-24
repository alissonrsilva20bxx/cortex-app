import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { proximoLembrete } from "@/lib/notificacoes";
import type { Job } from "@/lib/types";

/**
 * Cron diário (vercel.json) que dispara o lembrete opt-in do dia (§7.3).
 * Uma notificação por usuária no máximo — a lógica de qual (ou nenhuma)
 * mora em lib/notificacoes.ts, aqui é só orquestração: buscar quem tem
 * inscrição, buscar os jobs dela, mandar se houver algo, limpar inscrições
 * mortas (410/404 = o navegador cancelou por fora).
 */

function mapJob(row: {
  id: string;
  cliente_nome: string;
  data: string;
  hora: string;
  valor: number;
  modalidade: Job["modalidade"];
  local: string | null;
  status: Job["status"];
  observacoes: string | null;
  criado_em: string;
}): Job {
  return {
    id: row.id,
    clienteNome: row.cliente_nome,
    data: row.data,
    hora: row.hora,
    valor: row.valor,
    modalidade: row.modalidade,
    local: row.local ?? undefined,
    status: row.status,
    observacoes: row.observacoes ?? undefined,
    criadoEm: row.criado_em,
  };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(
    "mailto:suporte@jobapp.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const supabaseAdmin = getSupabaseAdmin();

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, cleaned: 0 });
  }

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  let sent = 0;
  let cleaned = 0;

  for (const userId of userIds) {
    const { data: jobRows } = await supabaseAdmin
      .from("jobs")
      .select(
        "id, cliente_nome, data, hora, valor, modalidade, local, status, observacoes, criado_em"
      )
      .eq("user_id", userId);

    const lembrete = proximoLembrete((jobRows ?? []).map(mapJob));
    if (!lembrete) continue;

    const payload = JSON.stringify({
      title: lembrete.title,
      body: lembrete.body,
      tag: lembrete.tag,
      url: "/",
    });

    const userSubs = subs.filter((s) => s.user_id === userId);
    for (const sub of userSubs) {
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
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          cleaned++;
        }
      }
    }
  }

  return NextResponse.json({ sent, cleaned });
}
