import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { garantirPerfil } from "../rede/perfis";
import {
  criarWishlistItem,
  type CriarWishlistItemInput,
  type WishlistItem,
} from "../rede/wishlist";

/** O banco ainda sem a 0049: a chave da dona é o perfil da Rede. */
function semPerfilNaRede(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === "23503";
}

/**
 * Cria o Desejo da dona. Desejo é de Finanças, não da Rede: com a 0049 não
 * pede perfil nem acesso à Rede. Com o banco ainda sem a 0049, o insert
 * falha por falta do perfil; aí cria o perfil e tenta de novo, como antes.
 */
export async function criarDesejo(
  client: SupabaseClient<Database>,
  input: CriarWishlistItemInput,
  dona: { userId: string; nome: string }
): Promise<WishlistItem> {
  try {
    return await criarWishlistItem(client, input);
  } catch (e) {
    if (!semPerfilNaRede(e)) throw e;
    await garantirPerfil(client, dona.userId, dona.nome);
    return criarWishlistItem(client, input);
  }
}
