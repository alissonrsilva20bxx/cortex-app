import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;

/** Ids bloqueados nos dois sentidos (quem eu bloqueei + quem me bloqueou) --
 * fonte única pra filtrar qualquer lista que mostre outras pessoas (amigas,
 * sugestões, solicitações, busca, notificações de solicitação), já que a
 * RLS de `rede_amizades`/`rede_perfis` não conhece bloqueios (só a de
 * conteúdo conhece, ver 0009). Extraído de `social.ts` pra `perfis.ts` e
 * `notificacoes.ts` poderem reusar sem criar import circular com `social.ts`
 * (que já importa de `perfis.ts`). */
export async function listarIdsBloqueados(
  client: RedeClient,
  userId: string
): Promise<Set<string>> {
  const [{ data: bloqueadaPor, error: e1 }, { data: bloqueei, error: e2 }] =
    await Promise.all([
      client
        .from("rede_bloqueios")
        .select("bloqueador_id")
        .eq("bloqueado_id", userId),
      client
        .from("rede_bloqueios")
        .select("bloqueado_id")
        .eq("bloqueador_id", userId),
    ]);

  if (e1) {
    throw e1;
  }
  if (e2) {
    throw e2;
  }

  const ids = new Set<string>();
  for (const b of bloqueadaPor ?? []) ids.add(b.bloqueador_id);
  for (const b of bloqueei ?? []) ids.add(b.bloqueado_id);
  return ids;
}
