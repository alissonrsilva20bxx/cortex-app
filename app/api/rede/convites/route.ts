import "server-only";

import { createHash, randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

// Sem caracteres ambíguos (0/O, 1/I/L) -- código é ditado/copiado à mão.
const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SUFIXO_TAMANHO = 4;

function gerarCodigoLegivel(): string {
  let sufixo = "";
  for (let i = 0; i < SUFIXO_TAMANHO; i++) {
    sufixo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }
  return `REDE-BETA-${sufixo}`;
}

function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

// Teclados no celular (principalmente iOS "Smart Punctuation") trocam "-"
// por travessão/en dash sozinhos, e minúscula/maiúscula não bate com o
// hash se a pessoa digitar em vez de colar. Como o formato do código é
// fixo (letras maiúsculas, dígitos, hífen), normalizar antes de hashear
// não abre brecha nenhuma -- só aceita a mesma grafia que já esperávamos.
// U+2010..U+2015 (hifen/travessoes tipograficos) + U+2212 (sinal de menos) --
// variantes que teclados com "smart punctuation" (iOS) trocam sozinhos no
// lugar do hifen comum ao digitar.
const TRACOS_UNICODE = /[‐-―−]/g;

function normalizarCodigo(bruto: string): string {
  return bruto.trim().toUpperCase().replace(TRACOS_UNICODE, "-");
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

  const codigo = gerarCodigoLegivel();
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
    codigo_hash: hashCodigo(normalizarCodigo(codigo)),
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
