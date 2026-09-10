import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { resolveGateAuth } from "../../../../lib/devPreview/serverAuth";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  ehJpeg,
  lerDimensoesJpeg,
  removerMetadados,
  contemMetadados,
} from "../../../../lib/rede/jpeg";

/**
 * Único caminho de upload de foto da Rede. O cliente perdeu o INSERT
 * direto em `storage.objects`/`rede_post_fotos` (migration 0033) -- então
 * um upload direto (curl com anon key, SDK no console) não tem como
 * contornar esta validação.
 *
 * Ordem, sempre: (1) autenticação, (2) membership na Rede, (3) posse do
 * post -- TUDO antes de qualquer escrita com service_role. Só então
 * valida as duas imagens e grava.
 *
 * Re-valida do zero, no servidor: formato JPEG, dimensão (SOF), tamanho
 * EXATO (<=150 KB principal / <=30 KB miniatura -- o teto de 160 KiB do
 * bucket é rede de segurança, NÃO garante esses limites), ausência de
 * metadado sensível. Nada é reprocessado (sem lib nativa de imagem); o
 * que não passa é REJEITADO -- nunca "corrigido pra caber", nunca
 * substituído pelo original.
 *
 * Falha parcial: o que já subiu é removido; se a remoção TAMBÉM falhar,
 * os paths vão pra `private.rede_midia_pendente_exclusao` (via
 * `rede_midia_reenfileirar_pendentes`, 0029) pra próxima varredura do
 * cron -- "tentar remover" não basta.
 */

const LIMITES = {
  principal: { maxLado: 1280, maxBytes: 150 * 1024, campo: "principal" },
  miniatura: { maxLado: 400, maxBytes: 30 * 1024, campo: "miniatura" },
} as const;

const MAX_FOTOS_POR_POST = 2;

function erro(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

async function validarJpeg(
  blob: unknown,
  lim: { maxLado: number; maxBytes: number; campo: string }
): Promise<{ limpo: Uint8Array; largura: number; altura: number }> {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error(`campo "${lim.campo}" ausente ou vazio`);
  }
  if (blob.size > lim.maxBytes) {
    throw new Error(
      `${lim.campo}: ${(blob.size / 1024).toFixed(0)} KB acima do teto de ${lim.maxBytes / 1024} KB`
    );
  }
  const original = new Uint8Array(await blob.arrayBuffer());
  if (!ehJpeg(original)) {
    throw new Error(`${lim.campo}: não é um JPEG`);
  }
  // remove metadado sensível no servidor mesmo que o cliente já tenha removido
  const limpo = removerMetadados(original);
  if (contemMetadados(limpo)) {
    throw new Error(
      `${lim.campo}: ainda contém metadado sensível após limpeza`
    );
  }
  let dim;
  try {
    dim = lerDimensoesJpeg(limpo);
  } catch {
    throw new Error(`${lim.campo}: JPEG ilegível`);
  }
  if (Math.max(dim.largura, dim.altura) > lim.maxLado) {
    throw new Error(
      `${lim.campo}: ${dim.largura}x${dim.altura} px acima do maior lado permitido (${lim.maxLado} px)`
    );
  }
  // teto EXATO de bytes, no arquivo que de fato vai pro Storage
  if (limpo.byteLength > lim.maxBytes) {
    throw new Error(
      `${lim.campo}: ${(limpo.byteLength / 1024).toFixed(0)} KB acima do teto de ${lim.maxBytes / 1024} KB após limpeza`
    );
  }
  return { limpo, largura: dim.largura, altura: dim.altura };
}

/** Best-effort remove + re-enfileira o que não sair, pra o cron tentar de
 * novo (0029). Nunca lança. */
async function limparOuEnfileirar(
  admin: ReturnType<typeof getSupabaseAdmin>,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  const { data: removidos, error } = await admin.storage
    .from("rede-midia")
    .remove(paths);
  const removidosSet = new Set((removidos ?? []).map((r) => r.name));
  const naoRemovidos = error
    ? paths
    : paths.filter((p) => !removidosSet.has(p));
  if (naoRemovidos.length > 0) {
    try {
      await admin.rpc("rede_midia_reenfileirar_pendentes", {
        paths: naoRemovidos,
      });
    } catch {
      /* best-effort: nada mais a fazer daqui */
    }
  }
}

export async function POST(request: NextRequest) {
  // (1) autenticação
  const auth = await resolveGateAuth(request);
  if (auth.kind === "unavailable") return erro(auth.message, 503);
  if (auth.kind === "unauthenticated") return erro("Não autenticado", 401);
  const { supabase, userId } = auth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return erro("Corpo inválido (esperado multipart/form-data)", 400);
  }

  const postId = String(form.get("postId") ?? "");
  const ordem = Number(form.get("ordem"));
  if (
    !postId ||
    !Number.isInteger(ordem) ||
    ordem < 1 ||
    ordem > MAX_FOTOS_POR_POST
  ) {
    return erro("postId/ordem inválidos", 400);
  }

  // (2) membership na Rede -- mesma condição que as policies de 0028
  // (rede_is_member) exigiam antes da 0033 tirar o INSERT do cliente
  const { data: ehMembro, error: membroErr } =
    await supabase.rpc("rede_is_member");
  if (membroErr) return erro("Não foi possível verificar o acesso à Rede", 500);
  if (ehMembro !== true) return erro("Sem acesso à Rede", 403);

  // (3) posse do post -- o select roda sob o JWT do usuário (RLS), então
  // um post que não é dele (ou que ele não pode ver) volta null
  const { data: post, error: postErr } = await supabase
    .from("rede_posts")
    .select("id,autor_id")
    .eq("id", postId)
    .maybeSingle();
  if (postErr) return erro("Não foi possível verificar a publicação", 500);
  if (!post || post.autor_id !== userId) {
    return erro("Publicação não encontrada", 404);
  }

  // validação das imagens (ainda sem escrever nada)
  let principal: Uint8Array;
  let miniatura: Uint8Array;
  let larguraPrincipal: number;
  let alturaPrincipal: number;
  try {
    const p = await validarJpeg(form.get("principal"), LIMITES.principal);
    const m = await validarJpeg(form.get("miniatura"), LIMITES.miniatura);
    principal = p.limpo;
    miniatura = m.limpo;
    larguraPrincipal = p.largura;
    alturaPrincipal = p.altura;
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Imagem inválida", 422);
  }

  // --- a partir daqui há escrita com service_role ---
  // `getSupabaseAdmin()` monta o client com `SUPABASE_SERVICE_ROLE_KEY`.
  // Se a env var faltar no ambiente (aconteceu no Preview `mockuptesterede`),
  // o `createClient` do supabase-js lança "supabaseKey is required" -- sem
  // este guard vira um 500 de corpo vazio e o `criarPost` do cliente não
  // tem erro nenhum pra mostrar. A mensagem do supabase-js NÃO contém a
  // chave; ainda assim registramos só o nome do erro, nunca `e.message`
  // nem o valor de nenhuma env var.
  let admin: ReturnType<typeof getSupabaseAdmin>;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    console.error(
      "[foto-upload] cliente service_role indisponível:",
      e instanceof Error ? e.name : "erro desconhecido"
    );
    return erro("Serviço de mídia indisponível", 503);
  }
  const stamp = Date.now();
  const base = `${userId}/posts/${postId}/${ordem}-${stamp}`;
  const path = `${base}.jpg`;
  // Convenção: os dois números no nome da miniatura são LARGURA×ALTURA em px
  // da imagem PRINCIPAL, medidas aqui no servidor (SOF do JPEG já validado e
  // sem metadados). O feed usa isso pra reservar a proporção do espaço antes
  // de qualquer imagem carregar (ver `dimensoesDaMiniatura` em lib/rede/feed).
  // A miniatura tem a mesma proporção da principal.
  const thumbPath = `${base}-thumb-${larguraPrincipal}x${alturaPrincipal}.jpg`;

  const { data: jaTem } = await admin
    .from("rede_post_fotos")
    .select("id")
    .eq("post_id", postId)
    .eq("ordem", ordem)
    .maybeSingle();
  if (jaTem) return erro("Essa posição de foto já foi usada", 409);

  const subiuPrincipal = await admin.storage
    .from("rede-midia")
    .upload(path, Buffer.from(principal), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (subiuPrincipal.error) {
    return erro("Falha ao gravar a imagem principal", 502);
  }

  const subiuThumb = await admin.storage
    .from("rede-midia")
    .upload(thumbPath, Buffer.from(miniatura), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (subiuThumb.error) {
    await limparOuEnfileirar(admin, [path]);
    return erro("Falha ao gravar a miniatura", 502);
  }

  const { error: linhaErr } = await admin.from("rede_post_fotos").insert({
    post_id: postId,
    autor_id: userId,
    path,
    thumb_path: thumbPath,
    ordem,
  });
  if (linhaErr) {
    await limparOuEnfileirar(admin, [path, thumbPath]);
    const conflito = (linhaErr as { code?: string }).code === "23505"; // unique(post_id,ordem) ou path
    return erro(
      conflito
        ? "Essa posição de foto já foi usada"
        : "Falha ao registrar a foto",
      conflito ? 409 : 500
    );
  }

  // Assina miniatura (placeholder) + principal -- o feed mostra a foto
  // grande e baixa a principal sob demanda (`loading="lazy"`).
  const { data: assinadas } = await admin.storage
    .from("rede-midia")
    .createSignedUrls([thumbPath, path], 5 * 60);
  const urlPorPath = new Map(
    (assinadas ?? []).map((s) => [s.path, s.signedUrl] as const)
  );

  return NextResponse.json(
    {
      path,
      thumbPath,
      ordem,
      thumbUrl: urlPorPath.get(thumbPath) ?? "",
      url: urlPorPath.get(path) ?? "",
      largura: larguraPrincipal,
      altura: alturaPrincipal,
    },
    { status: 201 }
  );
}
