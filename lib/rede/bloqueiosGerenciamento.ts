import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import type { PessoaResumo } from "./perfis";

type RedeClient = SupabaseClient<Database>;

/**
 * T8 (issue #35) precisa de nome/avatar de quem a usuária bloqueou, pra
 * tela de "Pessoas bloqueadas" com desbloquear. A RLS de `rede_perfis`
 * (0017) ficou simétrica de propósito e não deixa mais nem o próprio
 * bloqueador ler o perfil de quem bloqueou -- por isso a RPC nova e
 * estreita `rede_listar_bloqueados` (0018, security definer, só
 * user_id/nome_exibicao/cor_avatar, sempre filtrada por
 * `bloqueador_id = auth.uid()`). `rede_listar_bloqueados` ainda não está
 * em `lib/database.types.ts` (edição fora do escopo permitido deste
 * ticket) -- por isso o cast local, isolado neste arquivo só.
 */
export async function listarBloqueadosComNome(
  client: RedeClient
): Promise<PessoaResumo[]> {
  const untyped = client as unknown as SupabaseClient;
  const { data, error } = await untyped.rpc("rede_listar_bloqueados");

  if (error) {
    throw error;
  }

  return ((data ?? []) as
    | { user_id: string; nome_exibicao: string; cor_avatar: string }[]
    | null)!.map((row) => ({
    id: row.user_id,
    nome: row.nome_exibicao,
    cor: row.cor_avatar,
    bio: "",
    // `rede_listar_bloqueados` (0018) ainda não devolve avatar_url --
    // pessoas bloqueadas aparecem sem foto por enquanto (fast-follow: ver
    // migration que atualiza a função pra incluir a coluna).
    fotoUrl: null,
  }));
}
