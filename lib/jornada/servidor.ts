import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import type { EstadoJornada, PedidoRegistro, RespostaRegistro } from "./estado";

/**
 * A porta do app para o motor da Jornada no servidor (J10, migration
 * 0035_jornada_rpcs.sql). É o ÚNICO lugar que sabe o nome e os parâmetros
 * das RPCs; o transporte da camada cliente (`cliente.ts`, J11) chama isto.
 *
 * O contrato tem uma fonte só: os tipos de `estado.ts` (PedidoRegistro,
 * RespostaRegistro, EstadoJornada, Comemoracao). Nada é redeclarado aqui,
 * e nenhuma regra mora aqui: quanto Glow uma ação vale, o limite do dia,
 * selos, missões, marcos e estágio são decididos no banco (spec §8).
 *
 *  - `jornada_registrar(p_acao, p_chave, p_fuso, p_deslocamento_min)`
 *      -> RespostaRegistro ({ estado, comemoracoes, duplicada })
 *  - `jornada_estado(p_fuso, p_deslocamento_min)` -> EstadoJornada
 *
 * A usuária é sempre a do `auth.uid()` no servidor; nenhum id vai daqui.
 *
 * As RPCs ainda não estão em lib/database.types.ts (arquivo gerado e
 * compartilhado), por isso o cast local para uma chamada sem tipo, isolado
 * aqui -- mesmo padrão de lib/rede/bloqueiosGerenciamento.ts. A resposta é
 * conferida pela loja (`ehEstadoJornada`, `ehComemoracao`) antes de ser usada.
 */

type JornadaClient = SupabaseClient<Database>;

type RpcSemTipo = (
  funcao: string,
  args: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: unknown }>;

async function chamar(
  client: JornadaClient,
  funcao: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const rpc = client.rpc as unknown as RpcSemTipo;
  const { data, error } = await rpc.call(client, funcao, args);
  if (error) {
    throw error;
  }
  return data;
}

export async function registrarNoServidor(
  client: JornadaClient,
  pedido: PedidoRegistro
): Promise<RespostaRegistro> {
  return (await chamar(client, "jornada_registrar", {
    p_acao: pedido.acao,
    p_chave: pedido.chave,
    p_fuso: pedido.fuso,
    p_deslocamento_min: pedido.deslocamentoMin,
  })) as RespostaRegistro;
}

export async function lerEstadoDoServidor(
  client: JornadaClient,
  fuso: string,
  deslocamentoMin: number
): Promise<EstadoJornada> {
  return (await chamar(client, "jornada_estado", {
    p_fuso: fuso,
    p_deslocamento_min: deslocamentoMin,
  })) as EstadoJornada;
}
