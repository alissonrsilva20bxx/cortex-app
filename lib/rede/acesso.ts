import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;

/**
 * Por que `indeterminado` e não "erro de transporte": com
 * `@supabase/postgrest-js` >= 2.x uma leitura (`GET`) **quase nunca REJEITA
 * a promise** quando o `fetch` falha. O cliente tenta 3 vezes (backoff
 * 1s/2s/4s, ~7s no total) e então RESOLVE com uma resposta sintética
 * `{ data: null, error: { message: "TypeError: fetch failed", code: "" },
 * status: 0, statusText: "" }`. Confirmado em runtime (Node 24 + undici e
 * browser fetch). Ou seja: tratar só o `catch` como "offline" deixa passar
 * o caso real de rede caída direto pro ramo de "sem convite".
 *
 * Então a classificação é pelo `status` da resposta RESOLVIDA:
 *
 *  | resultado                                   | AcessoConvite            | gate faz            |
 *  |---------------------------------------------|-------------------------|---------------------|
 *  | 200 + convite resgatado                     | { unlocked: true }      | mostra o Feed       |
 *  | 200 + zero convites (RLS filtrou)           | { unlocked: false }     | LIMPA cache + vitrine |
 *  | status 0  (fetch não chegou ao servidor)    | indeterminado:transporte| PRESERVA o cache    |
 *  | status >= 500 (PostgREST/Postgres fora)     | indeterminado:servidor  | PRESERVA o cache    |
 *  | status 401/403 (JWT expirado/ausente)       | indeterminado:sessao    | PRESERVA o cache    |
 *
 * "Acesso revogado" chega como `200 + zero convites` (a policy de
 * `rede_convites` só FILTRA linhas por `usado_por = auth.uid()`, nunca
 * devolve permission denied pra um usuário logado) -- esse é o ÚNICO
 * resultado conclusivo de "sem acesso", e é o único que zera o cache.
 *
 * `unlocked` nunca é `true` sem um `200` trazendo um convite resgatado.
 */
export type MotivoIndeterminado = "transporte" | "servidor" | "sessao";

export type AcessoConvite = {
  unlocked: boolean;
  /** Presente quando a verificação NÃO chegou a um resultado conclusivo.
   * O gate preserva o conteúdo cacheado e segue otimista -- nunca mostra a
   * vitrine ("peça seu convite") por isto. Ver a tabela acima. */
  indeterminado?: MotivoIndeterminado;
};

function classificar(status: number): MotivoIndeterminado | null {
  if (status === 0) return "transporte";
  if (status >= 500) return "servidor";
  if (status === 401 || status === 403) return "sessao";
  return null;
}

/** Nunca rejeita -- toda falha vira `{ unlocked: false, ... }` (fail-closed)
 * em vez de deixar o chamador preso numa promise que nunca resolve. */
export async function verificarAcessoConvite(
  client: RedeClient,
  usuarioId: string
): Promise<AcessoConvite> {
  try {
    const { data, error, status } = await client
      .from("rede_convites")
      .select("id")
      .eq("usado_por", usuarioId)
      .limit(1);

    if (error) {
      const motivo = classificar(status);
      if (motivo) {
        // Rede caída / servidor fora / sessão expirada: NÃO conclui "sem
        // convite". O gate mantém o Feed cacheado em tela (req 4).
        console.warn(
          `[verificarAcessoConvite] indeterminado (${motivo}, status ${status})`,
          error
        );
        return { unlocked: false, indeterminado: motivo };
      }
      // 4xx que não é 401/403 -- não deveria acontecer nesta query (a RLS
      // filtra, não nega). Fail-closed conclusivo: o gate limpa o cache.
      console.error("[verificarAcessoConvite] erro conclusivo", {
        status,
        error,
      });
      return { unlocked: false };
    }

    return { unlocked: !!(data && data.length > 0) };
  } catch (e) {
    // Salvaguarda: cliente que REJEITA de fato (mock, throw síncrono, um
    // postgrest futuro). Trata como transporte -- preserva o cache.
    console.warn("[verificarAcessoConvite] promise rejeitada", e);
    return { unlocked: false, indeterminado: "transporte" };
  }
}
