import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;
type Denuncia = Database["public"]["Tables"]["rede_denuncias"]["Row"];
type AlvoTipo = Database["public"]["Enums"]["rede_denuncia_alvo_tipo"];
type Motivo = Database["public"]["Enums"]["rede_denuncia_motivo"];

export type CriarDenunciaInput = {
  alvoTipo: AlvoTipo;
  alvoId: string;
  motivo: Motivo;
  descricao?: string | null;
};

async function obterUsuarioId(client: RedeClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  return user.id;
}

export async function criarDenuncia(
  client: RedeClient,
  input: CriarDenunciaInput
): Promise<Denuncia> {
  const denuncianteId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_denuncias")
    .insert({
      denunciante_id: denuncianteId,
      alvo_tipo: input.alvoTipo,
      alvo_id: input.alvoId,
      motivo: input.motivo,
      descricao: input.descricao ?? null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
