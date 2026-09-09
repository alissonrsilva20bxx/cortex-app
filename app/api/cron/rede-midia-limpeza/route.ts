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
 * nunca pegam o mesmo path. Se `storage.remove()` falhar de verdade (erro
 * transiente de rede/API do Storage -- remover um path que já não existe
 * mais, ex.: excluirPost já limpou na hora, não é erro, só some do
 * resultado), os paths voltam pra fila via
 * `rede_midia_reenfileirar_pendentes` (migration 0029) em vez de ficarem
 * perdidos -- cron precisa ser idempotente e retomável, não só "roda uma
 * vez e torce" (ver https://vercel.com/docs/cron-jobs/manage-cron-jobs).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // `!cronSecret ||` é essencial: sem ela, um ambiente onde CRON_SECRET
  // nunca foi configurado aceitaria literalmente o header
  // "Authorization: Bearer undefined" (o template literal interpola
  // `undefined` como texto) -- mesmo padrão do exemplo oficial da Vercel
  // pra proteger cron jobs.
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
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
    // Achado na revisão do PR #105: o resultado desta chamada nunca era
    // checado -- se ELA TAMBÉM falhasse (rede caiu duas vezes seguidas),
    // os paths já tinham sumido da fila (drenados acima) e não voltavam,
    // perdidos de vez sem nenhum sinal além do 500 genérico abaixo.
    const { error: reenqueueError } = await supabaseAdmin.rpc(
      "rede_midia_reenfileirar_pendentes",
      { paths }
    );
    return NextResponse.json(
      {
        removidos: 0,
        reenfileirados: reenqueueError ? 0 : paths.length,
        error: removeError.message,
        reenqueueError: reenqueueError?.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ removidos: paths.length });
}
