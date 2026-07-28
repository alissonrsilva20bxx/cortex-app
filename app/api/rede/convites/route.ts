import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

const CODIGO_BYTES = 32;

function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

function obterIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "ip-desconhecido"
  );
}

async function obterUsuarioAutenticado() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
}

async function gerarConvite() {
  const { supabase, user, error: authError } = await obterUsuarioAutenticado();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const codigo = randomBytes(CODIGO_BYTES).toString("base64url");
  const { data, error } = await supabase.rpc("rede_gerar_convite", {
    codigo_hash: hashCodigo(codigo),
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Não foi possível gerar o convite" },
      { status: 500 }
    );
  }

  const convite = data as { id: string; expira_em: string };
  return NextResponse.json(
    { id: convite.id, codigo, expiraEm: convite.expira_em },
    { status: 201 }
  );
}

async function resgatarConvite(request: NextRequest, codigo: unknown) {
  const { supabase, user, error: authError } = await obterUsuarioAutenticado();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (typeof codigo !== "string" || codigo.length === 0) {
    return NextResponse.json(
      { error: "Convite inválido ou indisponível" },
      { status: 400 }
    );
  }

  // O código chega aqui em texto puro (o usuário colou/digitou), mas a
  // função no banco só aceita o hash -- ela valida o formato
  // (^[0-9a-f]{64}$) e rejeita qualquer coisa que não seja um SHA-256 já
  // calculado. Ver supabase/migrations/0015_rede_convites_rpc.sql.
  const { data, error } = await supabase.rpc("rede_resgatar_convite", {
    codigo_hash: hashCodigo(codigo),
    ip_hash: hashCodigo(obterIp(request)),
  });

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível resgatar o convite" },
      { status: 500 }
    );
  }

  const resultado = data as { status: string; retry_after?: number };
  if (resultado.status === "limitado") {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      {
        status: 429,
        headers: { "retry-after": String(resultado.retry_after ?? 1) },
      }
    );
  }

  if (resultado.status !== "resgatado") {
    return NextResponse.json(
      { error: "Convite inválido ou indisponível" },
      { status: 400 }
    );
  }

  return NextResponse.json({ resgatado: true });
}

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

  const body = recebido as { acao?: unknown; codigo?: unknown };
  if (body.acao === "gerar") {
    return gerarConvite();
  }

  if (body.acao === "resgatar") {
    return resgatarConvite(request, body.codigo);
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
