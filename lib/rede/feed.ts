import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;
type Post = Database["public"]["Tables"]["rede_posts"]["Row"];
type Comentario = Database["public"]["Tables"]["rede_comentarios"]["Row"];
export type Categoria = Database["public"]["Enums"]["rede_post_categoria"];

/** As 5 categorias de `rede_post_categoria` -- único lugar que define
 * label/cor pra elas, pra não triplicar em cada componente que exibe.
 * "geral" vem primeiro de propósito: é o default do composer
 * (`PostComposer.tsx`) -- a opção neutra pra quem não quer classificar a
 * publicação em nenhuma das outras 4 (migration 0025). */
export const CATEGORIA_META: Record<Categoria, { label: string; rgb: string }> =
  {
    // Literal (não var(--...)): não existe um "--muted-rgb" no design
    // system hoje -- mesmo padrão de "desabafo" logo abaixo, que também
    // usa uma tripla RGB literal por não ter variável de tema própria.
    geral: { label: "Geral", rgb: "148 163 184" },
    dica: { label: "Dica", rgb: "var(--info-rgb)" },
    conquista: { label: "Conquista", rgb: "var(--success-rgb)" },
    duvida: { label: "Dúvida", rgb: "var(--warning-rgb)" },
    desabafo: { label: "Desabafo", rgb: "167 139 250" },
  };

export type CriarPostInput = {
  categoria: Categoria;
  texto: string;
};

export type AtualizarPostInput = {
  postId: string;
  categoria: Categoria;
  texto: string;
};

export type ExcluirPostInput = {
  postId: string;
};

export type CriarComentarioInput = {
  postId: string;
  texto: string;
};

export type AlternarCurtidaInput = {
  postId: string;
};

/** Post + dados derivados que o feed precisa exibir -- não existe coluna
 * pra "curtidas"/"comentários" em `rede_posts`, é agregado client-side a
 * partir de `rede_curtidas`/`rede_comentarios` (ver `listarFeed`). Nome e
 * cor do autor vêm de `rede_perfis`, sem FK direta pro embedding do
 * PostgREST resolver sozinho. */
export type FeedPost = {
  id: string;
  autorId: string;
  autorNome: string;
  autorCor: string;
  categoria: Categoria;
  texto: string;
  criadoEm: string;
  atualizadoEm: string;
  curtidas: number;
  curtidoPorMim: boolean;
  comentariosCount: number;
};

export type FeedComment = {
  id: string;
  autorId: string;
  autorNome: string;
  autorCor: string;
  texto: string;
  criadoEm: string;
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

export async function listarFeed(client: RedeClient): Promise<FeedPost[]> {
  const userId = await obterUsuarioId(client);

  const { data: posts, error: postsError } = await client
    .from("rede_posts")
    .select("*")
    .order("criado_em", { ascending: false });

  if (postsError) {
    throw postsError;
  }

  if (!posts || posts.length === 0) {
    return [];
  }

  const postIds = posts.map((p) => p.id);
  const autorIds = Array.from(new Set(posts.map((p) => p.autor_id)));

  const [
    { data: curtidas, error: curtidasError },
    { data: comentarios, error: comentariosError },
    { data: perfis, error: perfisError },
  ] = await Promise.all([
    client
      .from("rede_curtidas")
      .select("post_id,user_id")
      .in("post_id", postIds),
    client.from("rede_comentarios").select("post_id").in("post_id", postIds),
    client
      .from("rede_perfis")
      .select("user_id,nome_exibicao,cor_avatar")
      .in("user_id", autorIds),
  ]);

  if (curtidasError) {
    throw curtidasError;
  }
  if (comentariosError) {
    throw comentariosError;
  }
  if (perfisError) {
    throw perfisError;
  }

  const curtidasPorPost = new Map<string, number>();
  const curtidoPorMim = new Set<string>();
  for (const c of curtidas ?? []) {
    curtidasPorPost.set(c.post_id, (curtidasPorPost.get(c.post_id) ?? 0) + 1);
    if (c.user_id === userId) {
      curtidoPorMim.add(c.post_id);
    }
  }

  const comentariosPorPost = new Map<string, number>();
  for (const c of comentarios ?? []) {
    comentariosPorPost.set(
      c.post_id,
      (comentariosPorPost.get(c.post_id) ?? 0) + 1
    );
  }

  const perfilPorAutor = new Map(
    (perfis ?? []).map((p) => [p.user_id, p] as const)
  );

  return posts.map((p) => {
    const perfil = perfilPorAutor.get(p.autor_id);
    return {
      id: p.id,
      autorId: p.autor_id,
      autorNome: perfil?.nome_exibicao ?? "Usuária",
      autorCor: perfil?.cor_avatar ?? "var(--accent)",
      categoria: p.categoria,
      texto: p.texto,
      criadoEm: p.criado_em,
      atualizadoEm: p.atualizado_em,
      curtidas: curtidasPorPost.get(p.id) ?? 0,
      curtidoPorMim: curtidoPorMim.has(p.id),
      comentariosCount: comentariosPorPost.get(p.id) ?? 0,
    };
  });
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

export async function atualizarPost(
  client: RedeClient,
  input: AtualizarPostInput
): Promise<Post> {
  const autorId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_posts")
    .update({ categoria: input.categoria, texto: input.texto })
    .eq("id", input.postId)
    .eq("autor_id", autorId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function excluirPost(
  client: RedeClient,
  input: ExcluirPostInput
): Promise<void> {
  const autorId = await obterUsuarioId(client);
  const { error } = await client
    .from("rede_posts")
    .delete()
    .eq("id", input.postId)
    .eq("autor_id", autorId);

  if (error) {
    throw error;
  }
}

export async function listarComentarios(
  client: RedeClient,
  postId: string
): Promise<FeedComment[]> {
  const { data: comentarios, error } = await client
    .from("rede_comentarios")
    .select("*")
    .eq("post_id", postId)
    .order("criado_em", { ascending: true });

  if (error) {
    throw error;
  }

  if (!comentarios || comentarios.length === 0) {
    return [];
  }

  const autorIds = Array.from(new Set(comentarios.map((c) => c.autor_id)));
  const { data: perfis, error: perfisError } = await client
    .from("rede_perfis")
    .select("user_id,nome_exibicao,cor_avatar")
    .in("user_id", autorIds);

  if (perfisError) {
    throw perfisError;
  }

  const perfilPorAutor = new Map(
    (perfis ?? []).map((p) => [p.user_id, p] as const)
  );

  return comentarios.map((c) => {
    const perfil = perfilPorAutor.get(c.autor_id);
    return {
      id: c.id,
      autorId: c.autor_id,
      autorNome: perfil?.nome_exibicao ?? "Usuária",
      autorCor: perfil?.cor_avatar ?? "var(--accent)",
      texto: c.texto,
      criadoEm: c.criado_em,
    };
  });
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
