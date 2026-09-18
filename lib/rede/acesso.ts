import {
  AuthRetryableFetchError,
  type SupabaseClient,
} from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;

/**
 * Por que classificar pelo `status` e não só tratar o `catch`: com
 * `@supabase/postgrest-js` >= 2.x uma leitura (`GET`) **quase nunca REJEITA
 * a promise** quando o `fetch` falha. O cliente tenta 3 vezes (backoff
 * 1s/2s/4s, ~7s no total) e então RESOLVE com uma resposta sintética
 * `{ data: null, error: { message: "TypeError: fetch failed" }, status: 0 }`.
 * Confirmado em runtime (Node 24 + undici e browser fetch).
 *
 * `verificarAcessoConvite` devolve `{ unlocked, motivo? }`:
 *
 *  | resposta                              | retorno                        | o gate faz                          |
 *  |--------------------------------------|--------------------------------|-------------------------------------|
 *  | 200 + convite resgatado              | { unlocked: true }             | libera; carimba o acesso confirmado |
 *  | 200 + zero convites                  | { unlocked: false, "sem_convite" } | DERRUBA: some da tela + zera cache |
 *  | status 0 (fetch não chegou)          | { unlocked: false, "indisponivel" } | preserva SÓ enquanto o acesso confirmado estiver dentro da validade |
 *  | status >= 500                        | { unlocked: false, "indisponivel" } | idem                              |
 *  | status 401 (JWT) e NÃO recuperou     | { unlocked: false, "sessao" }  | DERRUBA: conteúdo privado sai da tela |
 *  | status 403 / demais 4xx             | { unlocked: false, "negado" }  | DERRUBA -- não presume que é transitório |
 *
 * `401`: antes de desistir, tenta `auth.refreshSession()` uma vez. Se
 * recuperar a sessão, refaz a consulta; só devolve `"sessao"` se a sessão
 * continuar inválida.
 *
 * O PRÓPRIO `refreshSession()` pode falhar por dois motivos bem diferentes,
 * e `@supabase/auth-js` devolve os dois do MESMO jeito -- RESOLVE (não
 * rejeita) com `{ data: { session: null }, error }`:
 *  - sessão de fato inválida (refresh token expirado/revogado) -- perda de
 *    autorização real;
 *  - falha de REDE durante o próprio refresh (reconexão do iOS após 2º
 *    plano, DNS/TLS ainda não prontos) -- o SDK já tentou de novo sozinho
 *    (`_refreshAccessToken`, backoff próprio) e desistiu com um
 *    `AuthRetryableFetchError`, que segue sendo uma `AuthError` e por isso
 *    nunca chega a rejeitar a promise.
 * Confundir os dois faz uma reconexão instável DERRUBAR o acesso lembrado
 * (`RedeGatedTab.derrubar()`, zera memória + localStorage) como se a sessão
 * tivesse sido perdida de verdade -- só o 2º caso é `"indisponivel"`; o 1º
 * segue `"sessao"`.
 *
 * Nota sobre RLS: a policy de `rede_convites` hoje só FILTRA linhas por
 * `usado_por = auth.uid()`, mas NÃO usamos isso como garantia de que todo
 * erro de autorização é impossível -- `403`/`negado` derrubam o acesso do
 * mesmo jeito. Perdeu a autorização, o conteúdo privado local sai da tela.
 *
 * `unlocked` nunca é `true` sem um `200` trazendo um convite resgatado.
 */
export type AcessoMotivo = "sem_convite" | "indisponivel" | "sessao" | "negado";

export type AcessoConvite = { unlocked: boolean; motivo?: AcessoMotivo };

type ConsultaConvite = {
  data: { id: string }[] | null;
  error: unknown;
  status: number;
};

function consultar(
  client: RedeClient,
  usuarioId: string
): PromiseLike<ConsultaConvite> {
  return client
    .from("rede_convites")
    .select("id")
    .eq("usado_por", usuarioId)
    .limit(1) as unknown as PromiseLike<ConsultaConvite>;
}

function classificarErro(status: number): AcessoMotivo {
  if (status === 0 || status >= 500) return "indisponivel";
  if (status === 401) return "sessao";
  return "negado"; // 403 e demais 4xx: fail-closed, não presume transitório
}

function avaliar(r: ConsultaConvite): AcessoConvite {
  if (r.error) {
    return { unlocked: false, motivo: classificarErro(r.status) };
  }
  return r.data && r.data.length > 0
    ? { unlocked: true }
    : { unlocked: false, motivo: "sem_convite" };
}

/** Nunca rejeita -- toda falha vira `{ unlocked: false, motivo }`
 * (fail-closed) em vez de deixar o chamador preso numa promise. */
export async function verificarAcessoConvite(
  client: RedeClient,
  usuarioId: string
): Promise<AcessoConvite> {
  let r: ConsultaConvite;
  try {
    r = await consultar(client, usuarioId);
  } catch (e) {
    // Salvaguarda: cliente que REJEITA de fato (mock, throw síncrono).
    console.warn("[verificarAcessoConvite] promise rejeitada", e);
    return { unlocked: false, motivo: "indisponivel" };
  }

  // 401: tenta recuperar a sessão UMA vez antes de desistir.
  if (r.error && r.status === 401) {
    const { data, error } = await client.auth.refreshSession().catch((e) => ({
      data: { session: null },
      error: e instanceof Error ? e : new Error("refresh"),
    }));
    if (error) {
      // Falha de REDE durante o refresh (não a sessão em si) -- não é
      // perda de autorização confirmada. Só este tipo específico e
      // verificável de erro ganha o tratamento mais brando; qualquer outro
      // erro do refresh (incluindo um rejeitado desconhecido, capturado
      // acima) continua fail-closed como "sessao" -- ver o cabeçalho do
      // arquivo.
      if (error instanceof AuthRetryableFetchError) {
        console.warn(
          "[verificarAcessoConvite] refreshSession falhou por rede (401)",
          error
        );
        return { unlocked: false, motivo: "indisponivel" };
      }
      console.warn(
        "[verificarAcessoConvite] sessão não recuperada (401)",
        error
      );
      return { unlocked: false, motivo: "sessao" };
    }
    if (!data?.session) {
      console.warn("[verificarAcessoConvite] sessão não recuperada (401)");
      return { unlocked: false, motivo: "sessao" };
    }
    try {
      r = await consultar(client, usuarioId);
    } catch (e) {
      console.warn("[verificarAcessoConvite] promise rejeitada pós-refresh", e);
      return { unlocked: false, motivo: "indisponivel" };
    }
  }

  const resultado = avaliar(r);
  if (resultado.motivo && resultado.motivo !== "sem_convite") {
    console.warn(
      `[verificarAcessoConvite] ${resultado.motivo} (status ${r.status})`,
      r.error
    );
  }
  return resultado;
}
