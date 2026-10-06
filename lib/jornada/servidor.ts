import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type JornadaClient = SupabaseClient<Database>;

/**
 * Contrato com o motor da Jornada no servidor (J10, migration
 * 0035_jornada_rpcs.sql). Aqui só há os TIPOS do que as RPCs aceitam e
 * devolvem e um wrapper tipado de chamada -- nenhuma regra. Quanto Glow uma
 * ação vale, o limite do dia, selos, missões, marcos e estágio são
 * decididos no banco (spec §8, "Onde a decisão acontece"). Quem usa isto é
 * a camada do cliente (J11, lib/jornada/cliente.ts); telas não importam
 * este arquivo.
 *
 * As RPCs ainda não estão em lib/database.types.ts (arquivo gerado e
 * compartilhado), por isso o cast local para um client sem tipos, isolado
 * aqui -- mesmo padrão de lib/rede/bloqueiosGerenciamento.ts.
 */

/** Ações que o cliente pode registrar (as de "Isso me ajudou/protegeu"
 * creditam a autora da dica no servidor e não passam por aqui). */
export type AcaoJornada =
  | "despesa"
  | "receita"
  | "planejar"
  | "guardar_meta"
  | "comprovante_cofre"
  | "descanso"
  | "atendimento"
  | "abrir_jornada";

export type Pilar = "organizar" | "prosperar" | "proteger" | "conectar";

export type ChaveSelo =
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

/** Contadores do mês que as missões do capítulo usam. */
export type ChaveMissao =
  | "planejar"
  | "despesa"
  | "descanso"
  | "semanas_guardou"
  | "comprovante_cofre"
  | "dica_ajudou"
  | "dica_protegeu"
  | "dica_ajudou_ou_protegeu"
  | "dias_fortes"
  | "semanas_firmes";

/**
 * Um item da fila de comemoração. A fila já vem ORDENADA pelo servidor
 * (campo `ordem`): pequena -> missão -> selo -> capítulo -> estágio ->
 * marco -> meta. O cliente toca nessa ordem, um de cada vez.
 */
export type ItemFila =
  | { ordem: 1; tipo: "pequena"; acao: string; glow: number; pilar: Pilar }
  | {
      ordem: 2;
      tipo: "missao";
      missao: 1 | 2 | 3;
      chave: ChaveMissao;
      alvo: number;
    }
  | {
      ordem: 3;
      tipo: "selo";
      selo: ChaveSelo;
      nivel: 1 | 2 | 3;
      glow: number;
      pilar: Pilar;
    }
  | { ordem: 4; tipo: "capitulo"; ano: number; mes: number; glow: number }
  | {
      ordem: 5;
      tipo: "estagio";
      de: number;
      para: number;
      glow_total: number;
      itens: string[];
    }
  | { ordem: 6; tipo: "marco"; marco: 500 | 1000 | 2500 | 5000; glow: number }
  | { ordem: 7; tipo: "meta"; item_id: string; glow: number };

export interface RespostaRegistro {
  /** A mesma chave já tinha sido registrada: nada contou de novo. */
  duplicada: boolean;
  acao: AcaoJornada;
  /** A ação deu Glow (false acima do limite do dia e nas ações de 0 Glow). */
  concedeu: boolean;
  /** A ação contou dentro do limite do dia (atendimento: marcou o dia). */
  contou_no_dia: boolean;
  /** Todo o Glow desta chamada, prêmios de uma vez incluídos. */
  glow_ganho: number;
  glow_total: number;
  /** 0 Começando, 1 Em movimento, 2 Organizada, 3 Prosperando, 4 Icônica,
   * 5 Icônica II, ... (nunca zera). */
  estagio: number;
  fila: ItemFila[];
}

export interface PeriodoServidor {
  /** Primeiro dia do período (segunda-feira, dia 1, 1º de janeiro), AAAA-MM-DD. */
  inicio: string;
  /** Só números agregados ("despesa": 12, "dias_fortes": 4, "glow": 85...). */
  contadores: Record<string, number>;
}

type PorPeriodo = Partial<Record<"semana" | "mes" | "ano", PeriodoServidor>>;

export interface EstadoServidor {
  /** Hoje no fuso dela, AAAA-MM-DD. */
  hoje: string;
  glow_total: number;
  pilares: Record<Pilar, number>;
  estagio: number;
  /** Glow em que começa o próximo estágio. */
  proximo_estagio_em: number;
  selos: {
    selo: ChaveSelo;
    pilar: Pilar;
    /** 0 = ainda não conquistado. */
    nivel: 0 | 1 | 2 | 3;
    /** 1 para os selos de nível único, 3 para os demais. */
    niveis: 1 | 3;
    valor: number;
    /** null quando já está no último nível. */
    proximo_alvo: number | null;
    conquistado_ano: number | null;
    conquistado_mes: number | null;
  }[];
  capitulo: {
    ano: number;
    mes: number;
    fechado: boolean;
    missoes: {
      missao: 1 | 2 | 3;
      chave: ChaveMissao;
      alvo: number;
      progresso: number;
    }[];
  };
  colecao: { ano: number; mes: number }[];
  marcos: number[];
  destravados: string[];
  periodos: { corrente: Required<PorPeriodo>; ultimo_fechado: PorPeriodo };
  preferencias: {
    som_ligado: boolean;
    modo_discreto: boolean;
    estagio_no_perfil: boolean;
    selos_no_perfil: boolean;
    jornada_comeco: boolean;
    fuso: string | null;
  };
}

/**
 * Como o servidor resolve o dia dela (spec §2): o fuso IANA guardado nas
 * preferências; na falta dele, `fuso` (guardado na primeira chamada válida);
 * na falta dos dois, `deslocamentoMin`. Mande sempre os dois do aparelho.
 */
export interface FusoDoAparelho {
  fuso?: string | null;
  /** Minutos a somar ao UTC (o inverso de Date.getTimezoneOffset()). */
  deslocamentoMin?: number | null;
}

export interface OpcoesRegistro extends FusoDoAparelho {
  /**
   * Uma por ação da usuária, gerada UMA vez e repetida em qualquer reenvio:
   * é ela que impede contar duas vezes (StrictMode, rede instável).
   */
  chave: string;
  /** Só em "guardar_meta": o id do item da Wishlist em que ela guardou. */
  ref?: string | null;
}

export function fusoDoAparelho(agora: Date = new Date()): FusoDoAparelho {
  let fuso: string | null = null;
  try {
    fuso = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    fuso = null;
  }
  return { fuso, deslocamentoMin: -agora.getTimezoneOffset() };
}

export async function registrarNoServidor(
  client: JornadaClient,
  acao: AcaoJornada,
  opcoes: OpcoesRegistro
): Promise<RespostaRegistro> {
  const untyped = client as unknown as SupabaseClient;
  const { data, error } = await untyped.rpc("jornada_registrar", {
    p_acao: acao,
    p_chave: opcoes.chave,
    p_ref: opcoes.ref ?? null,
    p_fuso: opcoes.fuso ?? null,
    p_deslocamento_min: opcoes.deslocamentoMin ?? null,
  });
  if (error) {
    throw error;
  }
  return data as RespostaRegistro;
}

export async function lerEstadoDoServidor(
  client: JornadaClient,
  fuso: FusoDoAparelho = {}
): Promise<EstadoServidor> {
  const untyped = client as unknown as SupabaseClient;
  const { data, error } = await untyped.rpc("jornada_estado", {
    p_fuso: fuso.fuso ?? null,
    p_deslocamento_min: fuso.deslocamentoMin ?? null,
  });
  if (error) {
    throw error;
  }
  return data as EstadoServidor;
}
