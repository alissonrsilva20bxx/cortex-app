import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { listarIdsBloqueados } from "./bloqueios";
import { TEXTOS_LIVELINK } from "./textosLiveLink";

type RedeClient = SupabaseClient<Database>;
type Perfil = Database["public"]["Tables"]["rede_perfis"]["Row"];
type LiveLink = Database["public"]["Tables"]["rede_livelinks"]["Row"];

export const LIVELINK_TITULO_MAX_LENGTH = 100;
export const LIVELINK_URL_MAX_LENGTH = 2048;

/** Resumo de perfil pra listas (busca, amigas, sugestões) -- mais magro que
 * `Perfil` completo, que só o dono pede pra editar o próprio. */
export type PessoaResumo = {
  id: string;
  nome: string;
  cor: string;
  bio: string;
  fotoUrl: string | null;
};

function paraPessoaResumo(p: {
  user_id: string;
  nome_exibicao: string;
  cor_avatar: string;
  bio: string | null;
  avatar_url: string | null;
}): PessoaResumo {
  return {
    id: p.user_id,
    nome: p.nome_exibicao,
    cor: p.cor_avatar,
    bio: p.bio ?? "",
    fotoUrl: p.avatar_url,
  };
}

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
  /** `null` limpa a foto; `undefined` não mexe (mesmo padrão dos campos acima). */
  avatarUrl?: string | null;
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

export type AtualizarLiveLinkInput = {
  livelinkId: string;
  titulo: string;
  url: string;
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

/** Busca em lote por id, pra montar autor/nome/cor de listas (amizades,
 * sugestões, comentários...) sem 1 query por pessoa. */
export async function buscarPerfisPorIds(
  client: RedeClient,
  userIds: string[]
): Promise<Map<string, PessoaResumo>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("rede_perfis")
    .select("user_id,nome_exibicao,cor_avatar,bio,avatar_url")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((p) => [p.user_id, paraPessoaResumo(p)]));
}

/** Busca membros por nome pra Busca > Pessoas -- exclui a própria conta e
 * quem estiver bloqueado em qualquer sentido (mesmo critério de
 * `listarSugestoes` em social.ts; sem isso, alguém bloqueado continuava
 * achável e conseguia mandar um novo pedido de amizade pela Busca). */
export async function buscarPessoas(
  client: RedeClient,
  query: string
): Promise<PessoaResumo[]> {
  const termo = query.trim();
  if (!termo) {
    return [];
  }

  const userId = await obterUsuarioId(client);
  const [{ data, error }, bloqueados] = await Promise.all([
    client
      .from("rede_perfis")
      .select("user_id,nome_exibicao,cor_avatar,bio,avatar_url")
      .ilike("nome_exibicao", `%${termo}%`)
      .limit(20),
    listarIdsBloqueados(client, userId),
  ]);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((p) => p.user_id !== userId && !bloqueados.has(p.user_id))
    .map(paraPessoaResumo);
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
      avatar_url: input.avatarUrl,
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/** Título ou URL do LiveLink fora da regra: o texto (em português) diz o
 * que corrigir e pode ir para a tela; os outros erros (banco, rede) não. */
export class LiveLinkInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveLinkInvalidoError";
  }
}

function validarTituloUrlLiveLink(titulo: string, url: string) {
  if (titulo.length === 0 || titulo.length > LIVELINK_TITULO_MAX_LENGTH) {
    throw new LiveLinkInvalidoError(
      TEXTOS_LIVELINK.avisos.tituloTamanho(LIVELINK_TITULO_MAX_LENGTH)
    );
  }

  if (url.length === 0 || url.length > LIVELINK_URL_MAX_LENGTH) {
    throw new LiveLinkInvalidoError(
      TEXTOS_LIVELINK.avisos.urlTamanho(LIVELINK_URL_MAX_LENGTH)
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new LiveLinkInvalidoError(TEXTOS_LIVELINK.avisos.urlHttps);
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== ""
  ) {
    throw new LiveLinkInvalidoError(TEXTOS_LIVELINK.avisos.urlHttps);
  }
}

export async function criarLiveLink(
  client: RedeClient,
  input: CriarLiveLinkInput
): Promise<LiveLink> {
  const titulo = input.titulo.trim();
  const url = input.url.trim();
  validarTituloUrlLiveLink(titulo, url);

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

export async function atualizarLiveLink(
  client: RedeClient,
  input: AtualizarLiveLinkInput
): Promise<LiveLink> {
  const titulo = input.titulo.trim();
  const url = input.url.trim();
  validarTituloUrlLiveLink(titulo, url);

  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_livelinks")
    .update({ titulo, url })
    .eq("id", input.livelinkId)
    .eq("user_id", userId)
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

const CORES_AVATAR = [
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#6366f1",
];

export function corAvatarAleatoria(): string {
  return CORES_AVATAR[Math.floor(Math.random() * CORES_AVATAR.length)];
}

/** Devolve o perfil da Rede; se a pessoa nunca abriu a Rede, cria em silêncio
 * (nome da conta, cor aleatória), igual o RedeTab faz na primeira visita. */
export async function garantirPerfil(
  client: RedeClient,
  userId: string,
  nomeExibicao: string
): Promise<Perfil> {
  const existente = await buscarPerfil(client, userId);
  if (existente) return existente;
  return criarPerfil(client, {
    nomeExibicao,
    corAvatar: corAvatarAleatoria(),
  });
}
