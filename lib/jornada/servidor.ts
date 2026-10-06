import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

/**
 * Contrato com o motor da Jornada no servidor (J10, migration
 * 0035_jornada_rpcs.sql): os TIPOS do que as RPCs aceitam e devolvem e um
 * wrapper tipado de chamada -- nenhuma regra. Quanto Glow uma ação vale, o
 * limite do dia, selos, missões, marcos e estágio são decididos no banco
 * (spec §8, "Onde a decisão acontece").
 *
 * O formato é o que a camada cliente da J11 propôs (PR #187,
 * lib/jornada/estado.ts: PedidoRegistro, RespostaRegistro, EstadoJornada,
 * Comemoracao). Os tipos abaixo são estruturalmente os mesmos, declarados
 * aqui para este arquivo não depender de um PR ainda não mergeado; os
 * campos marcados "a mais" a J11 ainda não tipou (o validador dela os
 * ignora).
 *
 * As RPCs ainda não estão em lib/database.types.ts (arquivo gerado e
 * compartilhado), por isso o cast local para um client sem tipos, isolado
 * aqui -- mesmo padrão de lib/rede/bloqueiosGerenciamento.ts.
 */

type JornadaClient = SupabaseClient<Database>;

/** Ações que o cliente pode registrar. "Isso me ajudou/protegeu" credita a
 * autora da dica no servidor e não passa por aqui. `meta_concluida` não dá
 * nada por si: faz o servidor conferir as metas na Wishlist. */
export type AcaoServidor =
  | "despesa"
  | "receita"
  | "planejar"
  | "guardar_meta"
  | "comprovante_cofre"
  | "descanso"
  | "atendimento"
  | "abrir_jornada"
  | "meta_concluida";

export type PilarServidor = "organizar" | "prosperar" | "proteger" | "conectar";

export type SeloServidor =
  | "primeiros_passos"
  | "planejadora"
  | "mao_amiga"
  | "semana_firme"
  | "rumo_a_meta"
  | "tudo_guardado"
  | "descansar_conta"
  | "guardia"
  | "em_casa"
  | "mes_a_mes"
  | "um_ano";

export type TipoMissaoServidor =
  | "planejar_dias"
  | "lancar_despesas"
  | "tirar_descansos"
  | "guardar_semanas"
  | "comprovantes_cofre"
  | "dias_fortes"
  | "semanas_firmes"
  | "dica_ajudou"
  | "dica_protegeu"
  | "dica_ajudou_ou_protegeu";

export interface PeriodoServidor {
  /** Primeiro dia do período (segunda-feira, dia 1, 1º de janeiro), AAAA-MM-DD. */
  inicio: string;
  /** Só números agregados ("despesa": 12, "dias_fortes": 4, "glow": 85...). */
  contadores: Record<string, number>;
}

type PorPeriodo = Record<"semana" | "mes" | "ano", PeriodoServidor>;

/** O que `jornada_estado` devolve (e `jornada_registrar` em `estado`). */
export interface EstadoServidor {
  glowTotal: number;
  glowPorPilar: Record<PilarServidor, number>;
  /** 0 Começando, 1 Em movimento, 2 Organizada, 3 Prosperando, 4 Icônica,
   * 5 Icônica II... (nunca zera). */
  estagio: number;
  glowProximoEstagio: number;
  selos: Partial<Record<SeloServidor, 1 | 2 | 3>>;
  capitulo: {
    ano: number;
    mes: number;
    fechado: boolean;
    missoes: { tipo: TipoMissaoServidor; alvo: number; progresso: number }[];
  };
  colecao: { ano: number; mes: number }[];
  marcos: (500 | 1000 | 2500 | 5000)[];
  ajudou: number;
  protegeu: number;
  preferencias: {
    somLigado: boolean;
    modoDiscreto: boolean;
    /** Estágio OU selos no perfil público (a J09 guarda os dois à parte). */
    mostrarNoPerfil: boolean;
  };
  /** A mais: Glow em que começou o estágio atual (barra de progresso). */
  glowInicioEstagio: number;
  /** A mais: hoje no fuso dela, AAAA-MM-DD. */
  hoje: string;
  /** A mais: itens destravados por estágio (moldura_estagio_N, ...). */
  destravados: string[];
  /** A mais: período corrente e último retrato fechado (resumos, J14). */
  periodos: { corrente: PorPeriodo; ultimoFechado: Partial<PorPeriodo> };
}

/**
 * Uma comemoração. A fila vem na ordem do servidor: pequena -> selo ->
 * estagio -> capitulo -> marco -> meta. O cliente toca nessa ordem.
 */
export interface ComemoracaoServidor {
  /** Único: a chave da chamada + a posição na fila. */
  id: string;
  tipo: "pequena" | "selo" | "estagio" | "capitulo" | "marco" | "meta";
  glow: number;
  /** Na pequena: false = passou do limite do dia ("a contagem segue"). */
  ganhou: boolean;
  /** Comemoração grande vinda do atendimento: tocar na próxima abertura. */
  adiada: boolean;
  acao?: AcaoServidor;
  pilar?: PilarServidor | null;
  selo?: SeloServidor;
  nivel?: 1 | 2 | 3;
  /** No tipo "estagio": o estágio novo e o anterior. */
  estagio?: number;
  de?: number;
  /** No tipo "estagio": itens destravados agora. */
  itens?: string[];
  marco?: 500 | 1000 | 2500 | 5000;
  capitulo?: { ano: number; mes: number };
  /** No tipo "meta": o item da Wishlist concluído. */
  item_id?: string;
}

export interface RespostaRegistroServidor {
  estado: EstadoServidor;
  comemoracoes: ComemoracaoServidor[];
  /** A mesma chave já tinha sido registrada: nada contou de novo. */
  duplicada: boolean;
}

/** O que o cliente manda (PedidoRegistro da J11). */
export interface PedidoRegistroServidor {
  acao: AcaoServidor;
  /** Gerada UMA vez por ação e repetida em todo reenvio (8 a 64 de
   * [A-Za-z0-9_-]). É ela que impede contar duas vezes. */
  chave: string;
  /** Fuso IANA do aparelho. "UTC" genérico vale como "não sei". */
  fuso: string | null;
  /** Minutos a somar ao UTC (o inverso de Date.getTimezoneOffset()). */
  deslocamentoMin: number | null;
}

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
  pedido: PedidoRegistroServidor
): Promise<RespostaRegistroServidor> {
  return (await chamar(client, "jornada_registrar", {
    p_acao: pedido.acao,
    p_chave: pedido.chave,
    p_fuso: pedido.fuso,
    p_deslocamento_min: pedido.deslocamentoMin,
  })) as RespostaRegistroServidor;
}

export async function lerEstadoDoServidor(
  client: JornadaClient,
  fuso: string | null,
  deslocamentoMin: number | null
): Promise<EstadoServidor> {
  return (await chamar(client, "jornada_estado", {
    p_fuso: fuso,
    p_deslocamento_min: deslocamentoMin,
  })) as EstadoServidor;
}
