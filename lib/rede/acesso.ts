import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;

export type AcessoConvite = { unlocked: boolean };

/** Nunca rejeita -- uma falha de rede/consulta é tratada como "sem acesso
 * confirmado" (fail-closed) em vez de deixar o chamador preso esperando uma
 * promise que nunca resolve nem cai no catch. */
export async function verificarAcessoConvite(
  client: RedeClient,
  usuarioId: string
): Promise<AcessoConvite> {
  try {
    const { data, error } = await client
      .from("rede_convites")
      .select("id")
      .eq("usado_por", usuarioId)
      .limit(1);

    if (error) {
      console.error("[verificarAcessoConvite]", error);
      return { unlocked: false };
    }

    return { unlocked: !!(data && data.length > 0) };
  } catch (e) {
    console.error("[verificarAcessoConvite]", e);
    return { unlocked: false };
  }
}
