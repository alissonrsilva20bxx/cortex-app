import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { listarIdsBloqueados } from "./bloqueios";
import { buscarPerfisPorIds, type PessoaResumo } from "./perfis";

type RedeClient = SupabaseClient<Database>;
type Amizade = Database["public"]["Tables"]["rede_amizades"]["Row"];
type Bloqueio = Database["public"]["Tables"]["rede_bloqueios"]["Row"];
type StatusResposta = Extract<
  Database["public"]["Enums"]["rede_amizade_status"],
  "aceita" | "recusada"
>;

export type { PessoaResumo };

export type SolicitacaoAmizade = {
  id: string;
  pessoa: PessoaResumo;
};

export type EnviarPedidoAmizadeInput = {
  destinatarioId: string;
};

export type ResponderPedidoAmizadeInput = {
  amizadeId: string;
};

export type RemoverAmizadeInput = {
  outroUserId: string;
};

export type BloqueioInput = {
  bloqueadoId: string;
};

async function obterUsuarioId(client: RedeClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  return user.id;
}

export async function listarAmigas(
  client: RedeClient
): Promise<PessoaResumo[]> {
  const userId = await obterUsuarioId(client);
  const [
    { data: comoSolicitante, error: e1 },
    { data: comoDestinatario, error: e2 },
    bloqueados,
  ] = await Promise.all([
    client
      .from("rede_amizades")
      .select("destinatario_id")
      .eq("solicitante_id", userId)
      .eq("status", "aceita"),
    client
      .from("rede_amizades")
      .select("solicitante_id")
      .eq("destinatario_id", userId)
      .eq("status", "aceita"),
    listarIdsBloqueados(client, userId),
  ]);

  if (e1) {
    throw e1;
  }
  if (e2) {
    throw e2;
  }

  const ids = [
    ...(comoSolicitante ?? []).map((r) => r.destinatario_id),
    ...(comoDestinatario ?? []).map((r) => r.solicitante_id),
  ].filter((id) => !bloqueados.has(id));

  const perfis = await buscarPerfisPorIds(client, ids);
  return ids.map((id) => perfis.get(id)).filter((p): p is PessoaResumo => !!p);
}

export async function listarSolicitacoesPendentes(
  client: RedeClient
): Promise<SolicitacaoAmizade[]> {
  const userId = await obterUsuarioId(client);
  const [{ data: pedidos, error }, bloqueados] = await Promise.all([
    client
      .from("rede_amizades")
      .select("id,solicitante_id")
      .eq("destinatario_id", userId)
      .eq("status", "pendente"),
    listarIdsBloqueados(client, userId),
  ]);

  if (error) {
    throw error;
  }

  const filtrados = (pedidos ?? []).filter(
    (p) => !bloqueados.has(p.solicitante_id)
  );
  const perfis = await buscarPerfisPorIds(
    client,
    filtrados.map((p) => p.solicitante_id)
  );

  return filtrados
    .map((p) => {
      const pessoa = perfis.get(p.solicitante_id);
      return pessoa ? { id: p.id, pessoa } : null;
    })
    .filter((s): s is SolicitacaoAmizade => !!s);
}

export async function listarSolicitacoesEnviadas(
  client: RedeClient
): Promise<string[]> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_amizades")
    .select("destinatario_id")
    .eq("solicitante_id", userId)
    .eq("status", "pendente");

  if (error) {
    throw error;
  }

  return (data ?? []).map((r) => r.destinatario_id);
}

/** "Descobrir" -- toda outra membra sem relação (pendente/aceita/recusada)
 * nem bloqueio em nenhum sentido. Sem conceito de "amigas em comum": não
 * existe recomendação real, é diretório simples por enquanto. */
export async function listarSugestoes(
  client: RedeClient
): Promise<PessoaResumo[]> {
  const userId = await obterUsuarioId(client);
  const [
    { data: perfis, error },
    { data: relacoesA, error: eA },
    { data: relacoesB, error: eB },
    bloqueados,
  ] = await Promise.all([
    client
      .from("rede_perfis")
      .select("user_id,nome_exibicao,cor_avatar,bio,avatar_url"),
    client
      .from("rede_amizades")
      .select("destinatario_id")
      .eq("solicitante_id", userId),
    client
      .from("rede_amizades")
      .select("solicitante_id")
      .eq("destinatario_id", userId),
    listarIdsBloqueados(client, userId),
  ]);

  if (error) {
    throw error;
  }
  if (eA) {
    throw eA;
  }
  if (eB) {
    throw eB;
  }

  const excluidos = new Set<string>([
    userId,
    ...bloqueados,
    ...(relacoesA ?? []).map((r) => r.destinatario_id),
    ...(relacoesB ?? []).map((r) => r.solicitante_id),
  ]);

  return (perfis ?? [])
    .filter((p) => !excluidos.has(p.user_id))
    .map((p) => ({
      id: p.user_id,
      nome: p.nome_exibicao,
      cor: p.cor_avatar,
      bio: p.bio ?? "",
      fotoUrl: p.avatar_url,
    }));
}

export async function removerAmizade(
  client: RedeClient,
  input: RemoverAmizadeInput
): Promise<void> {
  const userId = await obterUsuarioId(client);
  const { error } = await client
    .from("rede_amizades")
    .delete()
    .eq("solicitante_id", userId)
    .eq("destinatario_id", input.outroUserId);
  if (error) {
    throw error;
  }

  const { error: error2 } = await client
    .from("rede_amizades")
    .delete()
    .eq("solicitante_id", input.outroUserId)
    .eq("destinatario_id", userId);
  if (error2) {
    throw error2;
  }
}

async function responderPedido(
  client: RedeClient,
  amizadeId: string,
  status: StatusResposta
): Promise<Amizade> {
  await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_amizades")
    .update({
      status,
      respondido_em: new Date().toISOString(),
    })
    .eq("id", amizadeId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function buscarPedidoInversoPendente(
  client: RedeClient,
  solicitanteId: string,
  destinatarioId: string
): Promise<Amizade | null> {
  const { data, error } = await client
    .from("rede_amizades")
    .select("*")
    .eq("solicitante_id", solicitanteId)
    .eq("destinatario_id", destinatarioId)
    .eq("status", "pendente")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function enviarPedidoAmizade(
  client: RedeClient,
  input: EnviarPedidoAmizadeInput
): Promise<Amizade> {
  const solicitanteId = await obterUsuarioId(client);
  const pedidoInverso = await buscarPedidoInversoPendente(
    client,
    input.destinatarioId,
    solicitanteId
  );

  if (pedidoInverso) {
    // Escolha de produto: pedidos pendentes no sentido inverso viram aceite automático.
    return responderPedido(client, pedidoInverso.id, "aceita");
  }

  const { data, error } = await client
    .from("rede_amizades")
    .insert({
      solicitante_id: solicitanteId,
      destinatario_id: input.destinatarioId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const pedidoCriadoConcorrentemente = await buscarPedidoInversoPendente(
        client,
        input.destinatarioId,
        solicitanteId
      );

      if (pedidoCriadoConcorrentemente) {
        return responderPedido(
          client,
          pedidoCriadoConcorrentemente.id,
          "aceita"
        );
      }
    }

    throw error;
  }

  return data;
}

export async function aceitarPedidoAmizade(
  client: RedeClient,
  input: ResponderPedidoAmizadeInput
): Promise<Amizade> {
  return responderPedido(client, input.amizadeId, "aceita");
}

export async function recusarPedidoAmizade(
  client: RedeClient,
  input: ResponderPedidoAmizadeInput
): Promise<Amizade> {
  return responderPedido(client, input.amizadeId, "recusada");
}

export async function bloquearUsuario(
  client: RedeClient,
  input: BloqueioInput
): Promise<Bloqueio> {
  const bloqueadorId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_bloqueios")
    .insert({
      bloqueador_id: bloqueadorId,
      bloqueado_id: input.bloqueadoId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function desbloquearUsuario(
  client: RedeClient,
  input: BloqueioInput
): Promise<void> {
  const bloqueadorId = await obterUsuarioId(client);
  const { error } = await client
    .from("rede_bloqueios")
    .delete()
    .eq("bloqueador_id", bloqueadorId)
    .eq("bloqueado_id", input.bloqueadoId);

  if (error) {
    throw error;
  }
}
