import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import type { Privacidade, WishlistEstado } from "../mockRede";

type RedeClient = SupabaseClient<Database>;
type WishlistRow = Database["public"]["Tables"]["rede_wishlist_items"]["Row"];

export type WishlistItem = {
  id: string;
  nome: string;
  cor: string;
  valorAlvo: number;
  valorAtual: number;
  estado: WishlistEstado;
  privacidade: Privacidade;
};

function paraWishlistItem(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    nome: row.nome,
    cor: row.cor,
    valorAlvo: Number(row.valor_alvo),
    valorAtual: Number(row.valor_atual),
    estado: row.estado as WishlistEstado,
    privacidade: row.privacidade as Privacidade,
  };
}

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

export type CriarWishlistItemInput = {
  nome: string;
  cor: string;
  valorAlvo: number;
  valorAtual?: number;
  estado?: WishlistEstado;
  privacidade?: Privacidade;
};

export async function criarWishlistItem(
  client: RedeClient,
  input: CriarWishlistItemInput
): Promise<WishlistItem> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_wishlist_items")
    .insert({
      user_id: userId,
      nome: input.nome.trim(),
      cor: input.cor,
      valor_alvo: input.valorAlvo,
      valor_atual: input.valorAtual,
      estado: input.estado,
      privacidade: input.privacidade,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return paraWishlistItem(data);
}

export type AtualizarWishlistItemInput = {
  itemId: string;
  nome: string;
  valorAlvo: number;
  valorAtual: number;
  estado: WishlistEstado;
  privacidade: Privacidade;
};

export async function atualizarWishlistItem(
  client: RedeClient,
  input: AtualizarWishlistItemInput
): Promise<WishlistItem> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_wishlist_items")
    .update({
      nome: input.nome.trim(),
      valor_alvo: input.valorAlvo,
      valor_atual: input.valorAtual,
      estado: input.estado,
      privacidade: input.privacidade,
    })
    .eq("id", input.itemId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return paraWishlistItem(data);
}

export async function listarWishlistItems(
  client: RedeClient,
  userId: string
): Promise<WishlistItem[]> {
  const { data, error } = await client
    .from("rede_wishlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("criado_em", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(paraWishlistItem);
}

export type ExcluirWishlistItemInput = {
  itemId: string;
};

export async function excluirWishlistItem(
  client: RedeClient,
  input: ExcluirWishlistItemInput
): Promise<void> {
  const userId = await obterUsuarioId(client);
  const { error } = await client
    .from("rede_wishlist_items")
    .delete()
    .eq("id", input.itemId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
