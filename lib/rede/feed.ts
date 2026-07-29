import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;
type Post = Database["public"]["Tables"]["rede_posts"]["Row"];
type Comentario = Database["public"]["Tables"]["rede_comentarios"]["Row"];
type Categoria = Database["public"]["Enums"]["rede_post_categoria"];

export type CriarPostInput = {
  categoria: Categoria;
  texto: string;
};

export type CriarComentarioInput = {
  postId: string;
  texto: string;
};

export type AlternarCurtidaInput = {
  postId: string;
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

export async function listarFeed(client: RedeClient): Promise<Post[]> {
  const { data, error } = await client
    .from("rede_posts")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function criarPost(
  client: RedeClient,
  input: CriarPostInput
): Promise<Post> {
  const autorId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_posts")
    .insert({
      autor_id: autorId,
      categoria: input.categoria,
      texto: input.texto,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function criarComentario(
  client: RedeClient,
  input: CriarComentarioInput
): Promise<Comentario> {
  const autorId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_comentarios")
    .insert({
      autor_id: autorId,
      post_id: input.postId,
      texto: input.texto,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function alternarCurtida(
  client: RedeClient,
  input: AlternarCurtidaInput
): Promise<{ curtido: boolean }> {
  const userId = await obterUsuarioId(client);
  const { data: curtida, error: leituraError } = await client
    .from("rede_curtidas")
    .select("post_id,user_id")
    .eq("post_id", input.postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (leituraError) {
    throw leituraError;
  }

  if (curtida) {
    const { error } = await client
      .from("rede_curtidas")
      .delete()
      .eq("post_id", input.postId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return { curtido: false };
  }

  const { error } = await client
    .from("rede_curtidas")
    .upsert(
      { post_id: input.postId, user_id: userId },
      { ignoreDuplicates: true, onConflict: "post_id,user_id" }
    );

  if (error) {
    throw error;
  }

  return { curtido: true };
}
