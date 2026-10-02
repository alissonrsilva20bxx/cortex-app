import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import {
  enviarPushPara,
  eventoRecente,
  nomeExibicao,
} from "../../../../../lib/rede/pushEnvio";
import { createClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Push de curtida e comentário pra autora da publicação. Mesmo desenho de
 * `amizades/notificar`: fire-and-forget depois da ação, e o servidor só
 * acredita no que lê com a sessão da chamadora:
 *   - curtida: a linha (post, eu) existe em `rede_curtidas` e é recente;
 *   - comentário: o comentário é meu, é desse post e é recente.
 * O post é lido com a mesma sessão; a RLS de `rede_posts` já esconde post
 * de quem bloqueou/foi bloqueada, então "não achei" = não notifica.
 * Curtir/comentar a própria publicação não notifica.
 */
export async function POST(request: NextRequest) {
  let recebido: unknown;
  try {
    recebido = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (
    recebido === null ||
    typeof recebido !== "object" ||
    Array.isArray(recebido)
  ) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { tipo, postId, comentarioId } = recebido as {
    tipo?: unknown;
    postId?: unknown;
    comentarioId?: unknown;
  };
  const valido =
    typeof postId === "string" &&
    postId.length > 0 &&
    (tipo === "curtida" ||
      (tipo === "comentario" &&
        typeof comentarioId === "string" &&
        comentarioId.length > 0));
  if (!valido) {
    return NextResponse.json(
      { error: "Parâmetros inválidos" },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: post, error: postError } = await supabase
    .from("rede_posts")
    .select("autor_id")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    return NextResponse.json(
      { error: "Não foi possível notificar" },
      { status: 500 }
    );
  }
  if (!post) {
    return NextResponse.json(
      { error: "Publicação não encontrada" },
      { status: 404 }
    );
  }
  if (post.autor_id === user.id) {
    return NextResponse.json({ sent: 0 });
  }

  let titulo: string;
  let corpo: string;
  let tag: string;
  if (tipo === "curtida") {
    const { data: curtida, error } = await supabase
      .from("rede_curtidas")
      .select("criado_em")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: "Não foi possível notificar" },
        { status: 500 }
      );
    }
    if (!curtida || !eventoRecente(curtida.criado_em)) {
      return NextResponse.json({ sent: 0 });
    }
    titulo = "Nova curtida";
    corpo = "curtiu sua publicação.";
    // Por post + quem curtiu: descurtir/curtir de novo substitui a
    // notificação em vez de empilhar.
    tag = `rede-curtida-${postId}-${user.id}`;
  } else {
    const { data: comentario, error } = await supabase
      .from("rede_comentarios")
      .select("autor_id, post_id, texto, criado_em")
      .eq("id", comentarioId as string)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: "Não foi possível notificar" },
        { status: 500 }
      );
    }
    if (
      !comentario ||
      comentario.autor_id !== user.id ||
      comentario.post_id !== postId ||
      !eventoRecente(comentario.criado_em)
    ) {
      return NextResponse.json({ sent: 0 });
    }
    const texto = comentario.texto.trim();
    titulo = "Novo comentário";
    corpo = `comentou: ${texto.length > 80 ? `${texto.slice(0, 80)}…` : texto}`;
    tag = `rede-comentario-${comentarioId}`;
  }

  const admin = getSupabaseAdmin();
  const nome = await nomeExibicao(admin, user.id);
  const resultado = await enviarPushPara(
    admin,
    [post.autor_id],
    { title: titulo, body: `${nome} ${corpo}`, tag },
    "notificar post"
  );

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.status }
    );
  }
  return NextResponse.json({ sent: resultado.sent });
}
