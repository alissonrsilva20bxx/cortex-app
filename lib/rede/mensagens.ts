import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;
type Mensagem = Database["public"]["Tables"]["rede_mensagens"]["Row"];
const SUBSCRIBE_TIMEOUT_MS = 10_000;
let proximaAssinaturaId = 0;

export type AbrirConversa1a1Input = {
  outroUserId: string;
};

export type EnviarMensagemInput = {
  conversaId: string;
  texto: string;
};

export type MarcarMensagemComoLidaInput = {
  conversaId: string;
  mensagemId: string;
};

export type AssinarMensagensConversaInput = {
  conversaId: string;
  onMensagem: (mensagem: Mensagem) => void;
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

async function exigirAcessoConversa(
  client: RedeClient,
  conversaId: string
): Promise<void> {
  await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_conversas")
    .select("id")
    .eq("id", conversaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  // A policy de SELECT combina participação, membership e ausência de bloqueio.
  if (!data) {
    throw new Error("Sem acesso à conversa");
  }
}

export async function abrirConversa1a1(
  client: RedeClient,
  input: AbrirConversa1a1Input
): Promise<string> {
  await obterUsuarioId(client);
  const { data, error } = await client.rpc("rede_criar_conversa_1a1", {
    outro_user_id: input.outroUserId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function enviarMensagem(
  client: RedeClient,
  input: EnviarMensagemInput
): Promise<Mensagem> {
  const autorId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_mensagens")
    .insert({
      conversa_id: input.conversaId,
      autor_id: autorId,
      texto: input.texto,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function marcarMensagemComoLida(
  client: RedeClient,
  input: MarcarMensagemComoLidaInput
): Promise<Mensagem> {
  await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_mensagens")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", input.mensagemId)
    .eq("conversa_id", input.conversaId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function assinarMensagensConversa(
  client: RedeClient,
  input: AssinarMensagensConversaInput
): Promise<RealtimeChannel> {
  await exigirAcessoConversa(client, input.conversaId);
  proximaAssinaturaId += 1;
  const channel = client.channel(
    `rede-mensagens:${input.conversaId}:${proximaAssinaturaId}`
  );

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "rede_mensagens",
      filter: `conversa_id=eq.${input.conversaId}`,
    },
    (payload: RealtimePostgresInsertPayload<Mensagem>) => {
      input.onMensagem(payload.new);
    }
  );

  await new Promise<void>((resolve, reject) => {
    let finalizado = false;
    let timeout: ReturnType<typeof setTimeout>;
    const concluirComErro = (status: string) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(timeout);
      void client.removeChannel(channel).finally(() => {
        reject(new Error(`Falha ao assinar conversa: ${status}`));
      });
    };

    timeout = setTimeout(
      () => concluirComErro("TIMED_OUT"),
      SUBSCRIBE_TIMEOUT_MS
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !finalizado) {
        finalizado = true;
        clearTimeout(timeout);
        resolve();
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        concluirComErro(status);
      }
    });
  });

  return channel;
}
