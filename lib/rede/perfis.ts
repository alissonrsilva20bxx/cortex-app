import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;
type Perfil = Database["public"]["Tables"]["rede_perfis"]["Row"];
type LiveLink = Database["public"]["Tables"]["rede_livelinks"]["Row"];

export type CriarPerfilInput = {
  nomeExibicao: string;
  corAvatar: string;
  bio?: string;
  areaAtuacao?: string;
};

export type AtualizarPerfilInput = {
  nomeExibicao?: string;
  bio?: string;
  corAvatar?: string;
  areaAtuacao?: string;
};

export type CriarLiveLinkInput = {
  titulo: string;
  url: string;
  ordem?: number;
};

export type ReordenarLiveLinksInput = {
  ids: string[];
};

export type ExcluirLiveLinkInput = {
  livelinkId: string;
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

export async function criarPerfil(
  client: RedeClient,
  input: CriarPerfilInput
): Promise<Perfil> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_perfis")
    .insert({
      user_id: userId,
      nome_exibicao: input.nomeExibicao,
      cor_avatar: input.corAvatar,
      bio: input.bio,
      area_atuacao: input.areaAtuacao,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function buscarPerfil(
  client: RedeClient,
  userId: string
): Promise<Perfil | null> {
  const { data, error } = await client
    .from("rede_perfis")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function atualizarPerfil(
  client: RedeClient,
  input: AtualizarPerfilInput
): Promise<Perfil> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_perfis")
    .update({
      nome_exibicao: input.nomeExibicao,
      bio: input.bio,
      cor_avatar: input.corAvatar,
      area_atuacao: input.areaAtuacao,
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function criarLiveLink(
  client: RedeClient,
  input: CriarLiveLinkInput
): Promise<LiveLink> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_livelinks")
    .insert({
      user_id: userId,
      titulo: input.titulo,
      url: input.url,
      ordem: input.ordem,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listarLiveLinks(
  client: RedeClient,
  userId: string
): Promise<LiveLink[]> {
  const { data, error } = await client
    .from("rede_livelinks")
    .select("*")
    .eq("user_id", userId)
    .order("ordem", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function reordenarLiveLinks(
  client: RedeClient,
  input: ReordenarLiveLinksInput
): Promise<LiveLink[]> {
  const userId = await obterUsuarioId(client);
  // Cada LiveLink pertence a um único dono, então as atualizações não colidem
  // entre si e podem rodar em paralelo com segurança.
  const resultados = await Promise.all(
    input.ids.map((id, ordem) =>
      client
        .from("rede_livelinks")
        .update({ ordem })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single()
    )
  );

  return resultados.map(({ data, error }) => {
    if (error) {
      throw error;
    }

    return data;
  });
}

export async function excluirLiveLink(
  client: RedeClient,
  input: ExcluirLiveLinkInput
): Promise<void> {
  const userId = await obterUsuarioId(client);
  const { error } = await client
    .from("rede_livelinks")
    .delete()
    .eq("id", input.livelinkId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
