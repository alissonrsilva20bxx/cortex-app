import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Cron (vercel.json) que drena a fila de exclusão de mídia da Rede
 * (migration 0028 §4). Existe porque `storage.objects` não tem FK nenhuma
 * com `rede_post_fotos` -- um DELETE em SQL (retenção de 300 posts, ou o
 * ON DELETE CASCADE de excluir um post) tira a linha da tabela, mas nunca
 * apaga o blob de verdade. Só a API de Storage faz isso, e só um client
 * server-side (service_role) deveria chamar `storage.remove()` em nome de
 * arquivos que não são mais do usuário autenticado atual (ex.: retenção
 * apagando o post antigo de OUTRA pessoa).
 *
 * `rede_midia_drenar_pendentes` já apaga as linhas da fila atomicamente ao
 * devolvê-las (DELETE ... RETURNING), então duas execuções concorrentes
 * nunca pegam o mesmo path. Se `storage.remove()` falhar pra um path que
 * já não existe mais (ex.: excluirPost já limpou na hora, ver
 * lib/rede/feed.ts), a linha da fila já foi consumida de qualquer forma --
 * não fica reprocessando pra sempre.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: pendentes, error } = await supabaseAdmin.rpc(
    "rede_midia_drenar_pendentes",
    { lote: 200 }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const paths = (pendentes ?? []).map((p) => p.path);
  if (paths.length === 0) {
    return NextResponse.json({ removidos: 0 });
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from("rede-midia")
    .remove(paths);

  if (removeError) {
    return NextResponse.json(
      { removidos: 0, error: removeError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ removidos: paths.length });
}
