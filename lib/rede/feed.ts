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

/** Bucket privado (0028) -- leitura respeita bloqueio mútuo via RLS
 * (private.rede_midia_pode_ler), então a URL assinada só funciona pra quem
 * já tinha permissão de ver o post no primeiro lugar. TTL de 1h: o feed
 * pode ficar aberto na tela por um tempo, mas não precisa ser "pra sempre"
 * como o público (0026 avatares). */
const REDE_MIDIA_BUCKET = "rede-midia";
const FOTO_URL_TTL_SEGUNDOS = 60 * 60;

/** No máx. 2 fotos por post -- também reforçado no schema
 * (`rede_post_fotos.ordem in (1,2)` + `unique(post_id, ordem)`, migration
 * 0028), então um bug aqui nunca vira uma 3ª linha de verdade no banco. */
export const MAX_FOTOS_POR_POST = 2;

/** `path` viaja junto (não só a URL já assinada) pra permitir renovar o
 * acesso quando a URL expirar sem precisar re-buscar o post inteiro -- ver
 * `renovarUrlFoto`. */
export type FotoPost = { url: string; ordem: number; path: string };

export type CriarPostInput = {
  categoria: Categoria;
  texto: string;
  /** 0-2 arquivos de imagem -- enviados ao Storage só depois do post
   * existir (o path exige {post_id}, ver migration 0028 §2). */
  fotos?: File[];
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
  autorFotoUrl: string | null;
  categoria: Categoria;
  texto: string;
  criadoEm: string;
  atualizadoEm: string;
  curtidas: number;
  curtidoPorMim: boolean;
  comentariosCount: number;
  /** Em ordem (1, depois 2 se houver) -- já com URL assinada pronta pra
   * <img src>, não o path bruto do Storage. */
  fotos: FotoPost[];
};

export type FeedComment = {
  id: string;
  autorId: string;
  autorNome: string;
  autorCor: string;
  autorFotoUrl: string | null;
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

/** Tamanho de página padrão de `listarFeed` -- mesmo padrão de
 * `MENSAGENS_PAGE_SIZE` (lib/rede/mensagens.ts, issue #54). */
export const FEED_PAGE_SIZE = 20;

export type ListarFeedOptions = {
  /** Máximo de posts retornados. */
  limit?: number;
  /** Cursor de paginação -- busca só posts estritamente mais antigos que
   * este `criado_em` (ISO). Omitido = página mais recente. */
  antesDe?: string;
};

export async function listarFeed(
  client: RedeClient,
  options: ListarFeedOptions = {}
): Promise<FeedPost[]> {
  const userId = await obterUsuarioId(client);

  let query = client
    .from("rede_posts")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(options.limit ?? FEED_PAGE_SIZE);

  if (options.antesDe) {
    query = query.lt("criado_em", options.antesDe);
  }

  const { data: posts, error: postsError } = await query;

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
    { data: fotosRows, error: fotosError },
  ] = await Promise.all([
    client
      .from("rede_curtidas")
      .select("post_id,user_id")
      .in("post_id", postIds),
    client.from("rede_comentarios").select("post_id").in("post_id", postIds),
    client
      .from("rede_perfis")
      .select("user_id,nome_exibicao,cor_avatar,avatar_url")
      .in("user_id", autorIds),
    client
      .from("rede_post_fotos")
      .select("post_id,path,ordem")
      .in("post_id", postIds)
      .order("ordem", { ascending: true }),
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
  if (fotosError) {
    throw fotosError;
  }

  // Assina todas as fotos da página numa chamada só (não uma por foto) --
  // `createSignedUrls` aceita um array de paths e devolve na mesma ordem.
  const urlPorPath = new Map<string, string>();
  const paths = (fotosRows ?? []).map((f) => f.path);
  if (paths.length > 0) {
    const { data: signed } = await client.storage
      .from(REDE_MIDIA_BUCKET)
      .createSignedUrls(paths, FOTO_URL_TTL_SEGUNDOS);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) {
        urlPorPath.set(s.path, s.signedUrl);
      }
    }
  }

  const fotosPorPost = new Map<string, FotoPost[]>();
  for (const f of fotosRows ?? []) {
    const url = urlPorPath.get(f.path);
    if (!url) continue; // assinatura falhou pra esse arquivo -- não quebra o post inteiro
    const arr = fotosPorPost.get(f.post_id) ?? [];
    arr.push({ url, ordem: f.ordem, path: f.path });
    fotosPorPost.set(f.post_id, arr);
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
      autorFotoUrl: perfil?.avatar_url ?? null,
      categoria: p.categoria,
      texto: p.texto,
      criadoEm: p.criado_em,
      atualizadoEm: p.atualizado_em,
      curtidas: curtidasPorPost.get(p.id) ?? 0,
      curtidoPorMim: curtidoPorMim.has(p.id),
      comentariosCount: comentariosPorPost.get(p.id) ?? 0,
      fotos: fotosPorPost.get(p.id) ?? [],
    };
  });
}

export type CriarPostResult = { post: Post; fotos: FotoPost[] };

/**
 * O path de Storage exige `{post_id}` (convenção `{user_id}/posts/{post_id}
 * /{arquivo}`, migration 0028), então a ordem é sempre: cria a linha de
 * `rede_posts` primeiro, só depois envia cada foto e insere sua linha em
 * `rede_post_fotos`. Fotos são enviadas em sequência (não paralelo) -- no
 * máximo 2, então o custo é desprezível, e sequencial deixa `ordem` (1, 2)
 * determinística sem precisar coordenar respostas concorrentes.
 *
 * Sem transação client-side possível aqui (Storage não participa da
 * transação Postgres) -- se a 2ª foto falhar, o post e a 1ª foto já
 * existem; deixamos assim (post publicado com 1 foto) em vez de tentar um
 * rollback manual, mesma filosofia pragmática do resto do app (ex.:
 * UploadSheet do Cofre também não reverte nada em erro parcial).
 */
export async function criarPost(
  client: RedeClient,
  input: CriarPostInput
): Promise<CriarPostResult> {
  const autorId = await obterUsuarioId(client);
  const { data: post, error } = await client
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

  const fotos: FotoPost[] = [];
  const arquivos = (input.fotos ?? []).slice(0, MAX_FOTOS_POR_POST);

  for (let i = 0; i < arquivos.length; i++) {
    const file = arquivos[i];
    const ordem = i + 1;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${autorId}/posts/${post.id}/${ordem}-${Date.now()}.${ext}`;

    const { error: uploadError } = await client.storage
      .from(REDE_MIDIA_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      throw uploadError;
    }

    const { error: fotoError } = await client
      .from("rede_post_fotos")
      .insert({ post_id: post.id, autor_id: autorId, path, ordem });
    if (fotoError) {
      throw fotoError;
    }

    const { data: signed } = await client.storage
      .from(REDE_MIDIA_BUCKET)
      .createSignedUrl(path, FOTO_URL_TTL_SEGUNDOS);
    fotos.push({ url: signed?.signedUrl ?? "", ordem, path });
  }

  return { post, fotos };
}

/**
 * URL assinada expira em 1h (`FOTO_URL_TTL_SEGUNDOS`) -- se uma aba ficar
 * aberta além disso sem recarregar o feed, a foto para de carregar. Chamado
 * do `onError` da `<img>` no PostCard: pede uma URL nova pro MESMO path já
 * conhecido, sem precisar re-buscar o post inteiro. RLS/bloqueio continuam
 * valendo aqui (a policy de leitura do bucket é reavaliada a cada
 * assinatura nova, não só na primeira).
 */
export async function renovarUrlFoto(
  client: RedeClient,
  path: string
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(REDE_MIDIA_BUCKET)
    .createSignedUrl(path, FOTO_URL_TTL_SEGUNDOS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
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

/**
 * Busca os paths das fotos ANTES de excluir o post -- depois do DELETE,
 * `rede_post_fotos` já foi apagada em cascata (FK on delete cascade) e não
 * há mais como descobrir quais arquivos eram dela. A limpeza do Storage
 * acontece na hora (não espera o cron): a fila de exclusão pendente
 * (migration 0028 §4, trigger em `rede_post_fotos`) ainda captura esses
 * mesmos paths como rede de segurança, então uma falha aqui (rede caiu no
 * meio, etc.) não perde o arquivo pra sempre -- só atrasa pro próximo
 * dreno do cron.
 */
export async function excluirPost(
  client: RedeClient,
  input: ExcluirPostInput
): Promise<void> {
  const autorId = await obterUsuarioId(client);

  const { data: fotos } = await client
    .from("rede_post_fotos")
    .select("path")
    .eq("post_id", input.postId)
    .eq("autor_id", autorId);

  const { error } = await client
    .from("rede_posts")
    .delete()
    .eq("id", input.postId)
    .eq("autor_id", autorId);

  if (error) {
    throw error;
  }

  if (fotos && fotos.length > 0) {
    const { error: removeError } = await client.storage
      .from(REDE_MIDIA_BUCKET)
      .remove(fotos.map((f) => f.path));
    if (removeError) {
      console.error("[feed] limpeza de fotos pós-exclusão falhou", removeError);
    }
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
    .select("user_id,nome_exibicao,cor_avatar,avatar_url")
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
      autorFotoUrl: perfil?.avatar_url ?? null,
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
