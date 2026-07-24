import { supabase } from "@/lib/supabase";

/**
 * Notificações push opt-in (§7.3): a existência de uma inscrição em
 * push_subscriptions JÁ é o opt-in — sem coluna de preferência separada.
 * Ativar = pedir permissão + registrar; desativar = cancelar + apagar.
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/** Pede permissão, registra a inscrição push e salva no Supabase. */
export async function subscribeToPush(userId: string): Promise<void> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error("Notificações não configuradas.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada.");
  }

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    // Não deixa uma inscrição órfã no navegador se o salvamento falhar —
    // senão a próxima checagem (isPushSubscribed) mente que está ativo.
    await sub.unsubscribe();
    throw error;
  }
}

/** Cancela a inscrição no navegador e apaga do Supabase (desativa de vez). */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } else {
    // Sem inscrição local (ex.: trocou de aparelho) — limpa qualquer
    // registro órfão deste usuário mesmo assim.
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
  }
}
