import type { SupabaseClient } from "@supabase/supabase-js";

import { faltaTabela } from "../bancoSemMigracao";
import type { Database } from "../database.types";
import { TEXTOS_GUARDAR } from "./textos";
import { lerValorGuardar } from "./valor";

type Client = SupabaseClient<Database>;

export type DepositoGuardado = {
  id: string;
  desejoId: string;
  valor: number;
  criadoEm: string;
};

export type ResultadoGuardar =
  | { ok: true; valorAtual: number }
  /** Nada foi gravado. */
  | { ok: false; etapa: "valor" | "historico"; erro: string }
  /** O depósito está no histórico, mas valor_atual não foi somado. */
  | {
      ok: false;
      etapa: "soma";
      erro: string;
      depositoId: string;
      centavos: number;
    };

/**
 * Guarda dinheiro num Desejo (Finanças):
 *  1. grava o depósito em guardar_historico;
 *  2. soma o valor em rede_wishlist_items.valor_atual (o app soma, sem trigger).
 * Se o passo 2 falhar o passo 1 continua gravado, e o resultado diz isso.
 * Sem a tabela do histórico no banco (0044 não aplicada), pula o passo 1 e
 * só soma: o Desejo e a meta da Jornada andam igual, só não há histórico.
 * Quem chama registra a ação "guardar_meta" da Jornada quando `ok`.
 */
export async function guardarNoDesejo(
  client: Client,
  input: { userId: string; desejoId: string; texto: string }
): Promise<ResultadoGuardar> {
  const lido = lerValorGuardar(input.texto);
  if (!lido.ok) return { ok: false, etapa: "valor", erro: lido.erro };
  if (!input.desejoId) {
    return { ok: false, etapa: "valor", erro: TEXTOS_GUARDAR.erroSemDesejo };
  }

  const ins = await client
    .from("guardar_historico")
    .insert({
      user_id: input.userId,
      desejo_id: input.desejoId,
      valor: lido.valor,
    })
    .select("id")
    .single();
  if (faltaTabela(ins.error, "guardar_historico")) {
    const soma = await somarNoDesejo(client, {
      userId: input.userId,
      desejoId: input.desejoId,
      centavos: lido.centavos,
    });
    // Sem histórico, nada ficou gravado se a soma falhar.
    return soma.ok
      ? { ok: true, valorAtual: soma.valorAtual }
      : { ok: false, etapa: "historico", erro: TEXTOS_GUARDAR.erroHistorico };
  }
  if (ins.error || !ins.data) {
    console.error("[guardar] falha ao gravar histórico:", ins.error?.message);
    return {
      ok: false,
      etapa: "historico",
      erro: TEXTOS_GUARDAR.erroHistorico,
    };
  }

  const resultado = await somarNoDesejo(client, {
    userId: input.userId,
    desejoId: input.desejoId,
    centavos: lido.centavos,
  });
  if (!resultado.ok) {
    return {
      ok: false,
      etapa: "soma",
      erro: TEXTOS_GUARDAR.erroSoma,
      depositoId: ins.data.id,
      centavos: lido.centavos,
    };
  }
  return { ok: true, valorAtual: resultado.valorAtual };
}

/** Lê o valor_atual de agora e grava valor_atual + depósito. */
export async function somarNoDesejo(
  client: Client,
  input: { userId: string; desejoId: string; centavos: number }
): Promise<{ ok: true; valorAtual: number } | { ok: false }> {
  const atual = await client
    .from("rede_wishlist_items")
    .select("valor_atual")
    .eq("id", input.desejoId)
    .eq("user_id", input.userId)
    .single();
  if (atual.error || !atual.data) {
    console.error("[guardar] falha ao ler valor_atual:", atual.error?.message);
    return { ok: false };
  }
  const novoCentavos =
    Math.round(Number(atual.data.valor_atual) * 100) + input.centavos;
  const upd = await client
    .from("rede_wishlist_items")
    .update({ valor_atual: novoCentavos / 100 })
    .eq("id", input.desejoId)
    .eq("user_id", input.userId)
    .select("valor_atual")
    .single();
  if (upd.error || !upd.data) {
    console.error("[guardar] falha ao somar valor_atual:", upd.error?.message);
    return { ok: false };
  }
  return { ok: true, valorAtual: Number(upd.data.valor_atual) };
}

/** Os últimos depósitos, ou `null` quando o banco ainda não tem a tabela do
 * histórico (0044 não aplicada): aí não há histórico para mostrar. */
export async function listarHistoricoGuardar(
  client: Client,
  userId: string,
  limite = 10
): Promise<DepositoGuardado[] | null> {
  const { data, error } = await client
    .from("guardar_historico")
    .select("id, desejo_id, valor, criado_em")
    .eq("user_id", userId)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (faltaTabela(error, "guardar_historico")) return null;
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    desejoId: r.desejo_id,
    valor: Number(r.valor),
    criadoEm: r.criado_em,
  }));
}
