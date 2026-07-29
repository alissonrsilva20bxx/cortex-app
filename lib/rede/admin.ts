import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;
type Denuncia = Database["public"]["Tables"]["rede_denuncias"]["Row"];
type StatusAdministrativo = Extract<
  Database["public"]["Enums"]["rede_denuncia_status"],
  "revisada" | "resolvida"
>;

export type AtualizarStatusDenunciaInput = {
  denunciaId: string;
  status: StatusAdministrativo;
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

export async function isAdmin(
  client: RedeClient,
  userId: string
): Promise<boolean> {
  // Pela RLS, o client só confirma o próprio usuário; outro userId retorna false.
  const { data, error } = await client
    .from("rede_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

async function exigirAdmin(client: RedeClient): Promise<string> {
  const userId = await obterUsuarioId(client);

  if (!(await isAdmin(client, userId))) {
    throw new Error("Acesso restrito a administradores");
  }

  return userId;
}

export async function listarDenuncias(client: RedeClient): Promise<Denuncia[]> {
  await exigirAdmin(client);
  const { data, error } = await client
    .from("rede_denuncias")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function atualizarStatusDenuncia(
  client: RedeClient,
  input: AtualizarStatusDenunciaInput
): Promise<Denuncia> {
  const adminId = await exigirAdmin(client);
  const timestamp = new Date().toISOString();
  const atualizacao =
    input.status === "revisada"
      ? {
          status: "revisada" as const,
          revisado_em: timestamp,
          revisado_por: adminId,
          revisado_por_auditoria: adminId,
        }
      : {
          status: "resolvida" as const,
          resolvido_em: timestamp,
          resolvido_por: adminId,
          resolvido_por_auditoria: adminId,
        };

  const { data, error } = await client
    .from("rede_denuncias")
    .update(atualizacao)
    .eq("id", input.denunciaId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
