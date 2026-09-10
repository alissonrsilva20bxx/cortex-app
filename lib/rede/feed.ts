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
 * (private.rede_midia_pode_ler) só na HORA DE ASSINAR: uma URL assinada,
 * uma vez emitida, é um bearer token -- continua funcionando até expirar
 * mesmo que um bloqueio aconteça depois (confirmado empiricamente na
 * revisão do PR #105: fetch direto na mesma URL, sem passar pelo cliente,
 * continuava 200 após o bloqueio; só ASSINAR uma URL nova é que passa a
 * ser negado). TTL curto (5min, não 1h) é a mitigação prática -- não
 * elimina a janela, mas limita o "acesso residual pós-bloqueio" a minutos
 * em vez de até uma hora. Bem mais curto que os 60min originais, mas mais
 * longo que os 120s do Cofre (que é single-file, não uma lista de feed
 * inteira -- reassinar tudo a cada 120s ficaria caro demais aqui). */
const REDE_MIDIA_BUCKET = "rede-midia";
const FOTO_URL_TTL_SEGUNDOS = 5 * 60;

/** No máx. 2 fotos por post -- também reforçado no schema
 * (`rede_post_fotos.ordem in (1,2)` + `unique(post_id, ordem)`, migration
 * 0028), então um bug aqui nunca vira uma 3ª linha de verdade no banco. */
export const MAX_FOTOS_POR_POST = 2;

/**
 * O feed carrega SÓ a miniatura (`thumbUrl` / `thumbPath`). A imagem
 * principal (`path`) não é baixada no feed -- só é assinada e aberta sob
 * demanda quando a pessoa toca na foto (ver `assinarUrlFoto`).
 *
 * `thumbPath`/`path` viajam junto (não só a URL já assinada) pra permitir
 * renovar o acesso quando a URL de 5min expirar sem re-buscar o post
 * inteiro. Fotos legadas (antes da migration 0033) não têm miniatura:
 * `thumbPath === path` e a `thumbUrl` aponta pra própria principal. */
export type FotoPost = {
  ordem: number;
  /** URL assinada da MINIATURA, pronta pra `<img src>` no feed. */
  thumbUrl: string;
  /** Path da miniatura no bucket (= `path` em fotos legadas sem miniatura). */
  thumbPath: string;
  /** Path da imagem principal -- assinada só ao abrir, nunca no feed. */
  path: string;
};

/** Duas imagens JPEG já processadas no cliente (ver `lib/rede/imagemComposer`),
 * prontas pra rota `POST /api/rede/foto-upload`. */
export type FotoParaUpload = { principal: Blob; miniatura: Blob };

export type CriarPostInput = {
  categoria: Categoria;
  texto: string;
  /** 0-2 fotos JÁ processadas no cliente (principal + miniatura JPEG) --
   * enviadas pela rota `POST /api/rede/foto-upload` só depois do post
   * existir (o path exige {post_id}). Ver `lib/rede/imagemComposer`. */
  fotos?: FotoParaUpload[];
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

/** Tamanho de página do feed -- 10 posts por página, conforme o escopo
 * aprovado da feature de fotos (a entrega original vinha com 20). */
export const FEED_PAGE_SIZE = 10;

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
      .select("post_id,path,thumb_path,ordem")
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

  // O feed assina SÓ as miniaturas -- a imagem principal não é baixada
  // aqui. Foto legada (thumb_path NULL) cai pra própria principal como
  // miniatura. Uma chamada só pra página inteira (`createSignedUrls`).
  const thumbDe = (f: { path: string; thumb_path: string | null }) =>
    f.thumb_path ?? f.path;
  const urlPorPath = new Map<string, string>();
  const thumbPaths = Array.from(
    new Set((fotosRows ?? []).map((f) => thumbDe(f)))
  );
  if (thumbPaths.length > 0) {
    const { data: signed } = await client.storage
      .from(REDE_MIDIA_BUCKET)
      .createSignedUrls(thumbPaths, FOTO_URL_TTL_SEGUNDOS);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) {
        urlPorPath.set(s.path, s.signedUrl);
      }
    }
  }

  const fotosPorPost = new Map<string, FotoPost[]>();
  for (const f of fotosRows ?? []) {
    const thumbPath = thumbDe(f);
    const thumbUrl = urlPorPath.get(thumbPath);
    if (!thumbUrl) continue; // assinatura falhou -- não quebra o post inteiro
    const arr = fotosPorPost.get(f.post_id) ?? [];
    arr.push({ ordem: f.ordem, thumbUrl, thumbPath, path: f.path });
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

type Mockish = { __mock?: true };

/**
 * Sobe uma foto (principal + miniatura) de um post que já existe.
 *
 * - Cliente REAL: `POST /api/rede/foto-upload` (multipart). Só a rota
 *   grava no Storage/`rede_post_fotos` (migration 0033 tirou o INSERT
 *   direto do cliente), e ela re-valida dimensão/tamanho/formato e remove
 *   metadados no servidor. Falha parcial é tratada lá dentro (nada órfão).
 * - Cliente MOCK (/dev-preview/app): grava direto no mock, que não tem
 *   RLS nem rota -- mesmo shape de retorno.
 */
async function enviarFotoDoPost(
  client: RedeClient,
  args: { postId: string; autorId: string; ordem: number; foto: FotoParaUpload }
): Promise<FotoPost> {
  const { postId, autorId, ordem, foto } = args;

  if ((client as unknown as Mockish).__mock) {
    const stamp = Date.now();
    const path = `${autorId}/posts/${postId}/${ordem}-${stamp}.jpg`;
    const thumbPath = `${autorId}/posts/${postId}/${ordem}-${stamp}-thumb.jpg`;
    await client.storage
      .from(REDE_MIDIA_BUCKET)
      .upload(path, foto.principal as unknown as File, {
        contentType: "image/jpeg",
      });
    await client.storage
      .from(REDE_MIDIA_BUCKET)
      .upload(thumbPath, foto.miniatura as unknown as File, {
        contentType: "image/jpeg",
      });
    await client
      .from("rede_post_fotos")
      .insert({
        post_id: postId,
        autor_id: autorId,
        path,
        thumb_path: thumbPath,
        ordem,
      });
    const { data: signed } = await client.storage
      .from(REDE_MIDIA_BUCKET)
      .createSignedUrl(thumbPath, FOTO_URL_TTL_SEGUNDOS);
    return { ordem, thumbUrl: signed?.signedUrl ?? "", thumbPath, path };
  }

  const form = new FormData();
  form.set("postId", postId);
  form.set("ordem", String(ordem));
  form.set("principal", foto.principal, `${ordem}.jpg`);
  form.set("miniatura", foto.miniatura, `${ordem}-thumb.jpg`);

  const resp = await fetch("/api/rede/foto-upload", {
    method: "POST",
    body: form,
  });
  const json = (await resp.json().catch(() => ({}))) as {
    path?: string;
    thumbPath?: string;
    thumbUrl?: string;
    error?: string;
  };
  if (!resp.ok || !json.path || !json.thumbPath) {
    throw new Error(
      json.error || `Falha ao enviar a foto (HTTP ${resp.status})`
    );
  }
  return {
    ordem,
    thumbUrl: json.thumbUrl ?? "",
    thumbPath: json.thumbPath,
    path: json.path,
  };
}

/**
 * Cria a linha de `rede_posts` primeiro (o path das fotos exige
 * `{post_id}`), depois envia cada foto em sequência (ordem 1, 2).
 *
 * Falha parcial: se QUALQUER foto falhar, o post recém-criado é apagado
 * (o que já subiu em Storage some pelo trigger de exclusão + `excluirPost`)
 * e o erro sobe -- nada de post publicado "pela metade" nem arquivo órfão.
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

  const aEnviar = (input.fotos ?? []).slice(0, MAX_FOTOS_POR_POST);
  const fotos: FotoPost[] = [];

  try {
    for (let i = 0; i < aEnviar.length; i++) {
      fotos.push(
        await enviarFotoDoPost(client, {
          postId: post.id,
          autorId,
          ordem: i + 1,
          foto: aEnviar[i],
        })
      );
    }
  } catch (e) {
    // rollback: apaga o post (cascade limpa rede_post_fotos; o trigger de
    // exclusão + excluirPost cuidam dos blobs que já subiram)
    await excluirPost(client, { postId: post.id }).catch(() => {});
    throw e;
  }

  return { post, fotos };
}

/**
 * Assina (ou re-assina) uma URL de leitura pra um path do bucket, com TTL
 * de `FOTO_URL_TTL_SEGUNDOS`. Dois usos:
 *   - renovar a miniatura quando a URL de 5min expira com a aba aberta
 *     (`onError` da `<img>` no PostCard);
 *   - assinar a imagem PRINCIPAL sob demanda quando a pessoa toca na foto
 *     (o feed nunca baixa a principal).
 * RLS/bloqueio são reavaliados a cada assinatura nova, não só na primeira.
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

/**
 * Assina em LOTE as URLs principais das fotos de UM post (no máximo 2) --
 * uma chamada só, pro FotoViewer não pagar um round-trip por foto ao
 * abrir/navegar. Mesmo TTL (`FOTO_URL_TTL_SEGUNDOS`), RLS/bloqueio
 * reavaliados na assinatura. Devolve um mapa path -> URL; paths que
 * falharem simplesmente não entram no mapa.
 */
export async function assinarUrlsFoto(
  client: RedeClient,
  paths: string[]
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (paths.length === 0) return mapa;
  const { data } = await client.storage
    .from(REDE_MIDIA_BUCKET)
    .createSignedUrls(paths, FOTO_URL_TTL_SEGUNDOS);
  for (const s of data ?? []) {
    if (s.signedUrl && s.path) mapa.set(s.path, s.signedUrl);
  }
  return mapa;
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
    .select("path,thumb_path")
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

  // Principal + miniatura das duas fotos. O trigger de exclusão
  // (migration 0033) também enfileira os dois paths como rede de
  // segurança, então uma falha aqui só adia pro próximo dreno do cron.
  const paths = (fotos ?? [])
    .flatMap((f) => [f.path, f.thumb_path])
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { error: removeError } = await client.storage
      .from(REDE_MIDIA_BUCKET)
      .remove(paths);
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
