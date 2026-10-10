import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import type {
  EstadoJornada,
  PedidoRegistro,
  Preferencias,
  RespostaRegistro,
} from "./estado";

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
 *  - preferências: a linha dela em `jornada_preferencias` (J09). Não há RPC:
 *    a RLS deixa a dona ler, criar e alterar a própria linha, e só ela.
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

/** Colunas de `jornada_preferencias` (J09) que a tela grava e lê de volta. */
interface LinhaPreferencias {
  som_ligado: boolean;
  modo_discreto: boolean;
  estagio_no_perfil: boolean;
  selos_no_perfil: boolean;
  comemoracoes_calmas: boolean;
  jornada_comeco: boolean;
}

type TabelaSemTipo = {
  upsert: (
    linha: Record<string, unknown>,
    opcoes: { onConflict: string }
  ) => {
    select: (colunas: string) => {
      single: () => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
};

/**
 * Grava só as preferências mandadas e devolve como ficaram. A usuária é a
 * da sessão (a RLS confere `auth.uid() = user_id`). "Mostrar no perfil" é
 * um só pro cliente e dois opt-ins na J09 (estágio, selos): grava os dois,
 * do mesmo jeito que `jornada_estado` lê os dois como um.
 */
export async function salvarPreferenciasNoServidor(
  client: JornadaClient,
  parcial: Partial<Preferencias>
): Promise<Preferencias> {
  const { data: sessao, error: erroSessao } = await client.auth.getUser();
  if (erroSessao || !sessao.user) {
    throw erroSessao ?? new Error("auth");
  }
  const linha: Record<string, unknown> = { user_id: sessao.user.id };
  if (parcial.somLigado !== undefined) linha.som_ligado = parcial.somLigado;
  if (parcial.modoDiscreto !== undefined) {
    linha.modo_discreto = parcial.modoDiscreto;
  }
  if (parcial.mostrarNoPerfil !== undefined) {
    linha.estagio_no_perfil = parcial.mostrarNoPerfil;
    linha.selos_no_perfil = parcial.mostrarNoPerfil;
  }
  // Folha de Ajustes do protótipo (0036): cada chave na sua coluna.
  if (parcial.estagioNoPerfil !== undefined) {
    linha.estagio_no_perfil = parcial.estagioNoPerfil;
  }
  if (parcial.selosNoPerfil !== undefined) {
    linha.selos_no_perfil = parcial.selosNoPerfil;
  }
  if (parcial.comemoracoesCalmas !== undefined) {
    linha.comemoracoes_calmas = parcial.comemoracoesCalmas;
  }
  if (parcial.jornadaComeco !== undefined) {
    linha.jornada_comeco = parcial.jornadaComeco;
  }
  const tabela = (
    client.from as unknown as (nome: string) => TabelaSemTipo
  ).call(client, "jornada_preferencias");
  const { data, error } = await tabela
    .upsert(linha, { onConflict: "user_id" })
    .select(
      "som_ligado, modo_discreto, estagio_no_perfil, selos_no_perfil, comemoracoes_calmas, jornada_comeco"
    )
    .single();
  if (error) {
    throw error;
  }
  const r = data as LinhaPreferencias;
  return {
    somLigado: r.som_ligado,
    modoDiscreto: r.modo_discreto,
    mostrarNoPerfil: r.estagio_no_perfil || r.selos_no_perfil,
    estagioNoPerfil: r.estagio_no_perfil,
    selosNoPerfil: r.selos_no_perfil,
    comemoracoesCalmas: r.comemoracoes_calmas,
    jornadaComeco: r.jornada_comeco,
  };
}
