import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;
type Amizade = Database["public"]["Tables"]["rede_amizades"]["Row"];
type Bloqueio = Database["public"]["Tables"]["rede_bloqueios"]["Row"];
type StatusResposta = Extract<
  Database["public"]["Enums"]["rede_amizade_status"],
  "aceita" | "recusada"
>;

export type EnviarPedidoAmizadeInput = {
  destinatarioId: string;
};

export type ResponderPedidoAmizadeInput = {
  amizadeId: string;
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
