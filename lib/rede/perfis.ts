import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;
type Perfil = Database["public"]["Tables"]["rede_perfis"]["Row"];
type LiveLink = Database["public"]["Tables"]["rede_livelinks"]["Row"];

export const LIVELINK_TITULO_MAX_LENGTH = 100;
export const LIVELINK_URL_MAX_LENGTH = 2048;

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
  const titulo = input.titulo.trim();
  const url = input.url.trim();

  if (titulo.length === 0 || titulo.length > LIVELINK_TITULO_MAX_LENGTH) {
    throw new Error(
      `Título do LiveLink deve ter entre 1 e ${LIVELINK_TITULO_MAX_LENGTH} caracteres`
    );
  }

  if (url.length === 0 || url.length > LIVELINK_URL_MAX_LENGTH) {
    throw new Error(
      `URL do LiveLink deve ter entre 1 e ${LIVELINK_URL_MAX_LENGTH} caracteres`
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("URL do LiveLink deve ser uma URL HTTPS absoluta");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== ""
  ) {
    throw new Error("URL do LiveLink deve ser uma URL HTTPS absoluta");
  }

  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_livelinks")
    .insert({
      user_id: userId,
      titulo,
      url,
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
  const { data, error } = await client.rpc("rede_reordenar_livelinks", {
    livelink_ids: input.ids,
  });

  if (error) {
    throw error;
  }

  return data;
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
