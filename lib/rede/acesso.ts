import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;

/**
 * `erro: true` significa **falha de transporte** (o `fetch` REJEITOU:
 * offline, DNS, conexão recusada, TLS) -- e SÓ isso. Nesse caso o
 * `RedeGatedTab` preserva o conteúdo cacheado em tela (req 4).
 *
 * Uma resposta que CHEGOU do servidor mas veio com erro (401/403 de sessão
 * inválida, 42501 de RLS/permissão, 5xx, JWT expirado) **não** é `erro` de
 * rede: `unlocked` é `false` e o gate DESCARTA o cache (req 1/3). Tratamos
 * fail-closed -- o servidor falou, e não confirmou acesso.
 *
 * `unlocked` nunca é `true` sem uma resposta OK que traga um convite
 * resgatado -- nunca destrava por engano.
 */
export type AcessoConvite = { unlocked: boolean; erro?: boolean };

/** Nunca rejeita -- toda falha vira `{ unlocked: false }` (fail-closed) em
 * vez de deixar o chamador preso numa promise que nunca resolve. */
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
      // A resposta CHEGOU e veio com erro (sessão inválida, RLS, 5xx...):
      // fail-closed SEM `erro` -- o gate limpa o cache. Não é falha de rede.
      console.error("[verificarAcessoConvite] resposta com erro", error);
      return { unlocked: false };
    }

    return { unlocked: !!(data && data.length > 0) };
  } catch (e) {
    // O `fetch` REJEITOU: falha de transporte de verdade. Preserva o cache.
    console.error("[verificarAcessoConvite] falha de transporte", e);
    return { unlocked: false, erro: true };
  }
}
