import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "../../../../lib/supabase-server";

export async function POST(_request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("rede_solicitacoes_beta")
    .insert({ user_id: user.id })
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
}
