import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { resolveGateAuth } from "../../../../lib/devPreview/serverAuth";

const SERVICO_INDISPONIVEL =
  "Serviço indisponível — não foi possível contatar o Supabase.";

export async function POST(request: NextRequest) {
  const auth = await resolveGateAuth(request);
  if (auth.kind === "unavailable") {
    return NextResponse.json({ error: auth.message }, { status: 503 });
  }
  if (auth.kind === "unauthenticated") {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  try {
    const { data, error } = await supabase
      .from("rede_solicitacoes_beta")
      .insert({ user_id: userId })
      .select("id,status")
      .single();

    if (error?.code === "23505") {
      return NextResponse.json({ solicitada: true, jaExistia: true });
    }

    if (error) {
      return NextResponse.json(
        { error: "Não foi possível solicitar a beta" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        solicitada: true,
        jaExistia: false,
        solicitacao: data,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: SERVICO_INDISPONIVEL },
      { status: 503 }
    );
  }
}
