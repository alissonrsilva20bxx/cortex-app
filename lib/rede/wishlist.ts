import type { SupabaseClient } from "@supabase/supabase-js";

import { faltaColuna } from "../bancoSemMigracao";
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
  prazo: string | null;
  criadoEm: string;
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
    prazo: row.prazo ?? null,
    criadoEm: row.criado_em,
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
  estado?: WishlistEstado;
  privacidade?: Privacidade;
  prazo?: string | null;
};

/** Aviso no log quando o banco ainda não tem a coluna `prazo` (0042). */
function avisarSemPrazo() {
  console.warn(
    "[wishlist] o banco ainda não tem a coluna prazo (0042): Desejo salvo sem prazo."
  );
}

/**
 * Cria o Desejo. Sem prazo, a coluna nem vai no pedido (o default é vazio).
 * Com prazo e o banco ainda sem a 0042, salva sem o prazo: o item volta com
 * `prazo: null`, e quem chama vê que o prazo ficou de fora.
 */
export async function criarWishlistItem(
  client: RedeClient,
  input: CriarWishlistItemInput
): Promise<WishlistItem> {
  const userId = await obterUsuarioId(client);
  const inserir = (comPrazo: boolean) =>
    client
      .from("rede_wishlist_items")
      .insert({
        user_id: userId,
        nome: input.nome.trim(),
        cor: input.cor,
        valor_alvo: input.valorAlvo,
        estado: input.estado,
        privacidade: input.privacidade,
        ...(comPrazo ? { prazo: input.prazo } : {}),
      })
      .select()
      .single();

  let { data, error } = await inserir(Boolean(input.prazo));
  if (input.prazo && faltaColuna(error, "prazo")) {
    avisarSemPrazo();
    ({ data, error } = await inserir(false));
  }

  if (error || !data) {
    throw error ?? new Error("Desejo não foi criado");
  }

  return paraWishlistItem(data);
}

export type AtualizarWishlistItemInput = {
  itemId: string;
  nome: string;
  valorAlvo: number;
  estado: WishlistEstado;
  privacidade: Privacidade;
  prazo?: string | null;
};

export async function atualizarWishlistItem(
  client: RedeClient,
  input: AtualizarWishlistItemInput
): Promise<WishlistItem> {
  const userId = await obterUsuarioId(client);
  const campos = {
    nome: input.nome.trim(),
    valor_alvo: input.valorAlvo,
    estado: input.estado,
    privacidade: input.privacidade,
  };
  const atualizar = (comPrazo: boolean) =>
    client
      .from("rede_wishlist_items")
      .update(comPrazo ? { ...campos, prazo: input.prazo } : campos)
      .eq("id", input.itemId)
      .eq("user_id", userId)
      .select()
      .single();

  // O prazo vai mesmo vazio (null limpa o prazo que existia). Sem a 0042 no
  // banco, salva o resto sem o prazo.
  const comPrazo = input.prazo !== undefined;
  let { data, error } = await atualizar(comPrazo);
  if (comPrazo && faltaColuna(error, "prazo")) {
    if (input.prazo) avisarSemPrazo();
    ({ data, error } = await atualizar(false));
  }

  if (error || !data) {
    throw error ?? new Error("Desejo não foi atualizado");
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
