import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { buscarPerfisPorIds } from "./perfis";

type RedeClient = SupabaseClient<Database>;
type Mensagem = Database["public"]["Tables"]["rede_mensagens"]["Row"];
const SUBSCRIBE_TIMEOUT_MS = 10_000;
let proximaAssinaturaId = 0;

export type AbrirConversa1a1Input = {
  outroUserId: string;
};

/** Mensagem já com `deMim` resolvido contra o usuário autenticado -- a
 * tabela crua só guarda `autor_id`, quem é "eu" depende de quem pergunta. */
export type MensagemChat = {
  id: string;
  autorId: string;
  texto: string;
  criadoEm: string;
  lidaEm: string | null;
  deMim: boolean;
};

export type ConversaResumo = {
  id: string;
  outroUserId: string;
  outroNome: string;
  outroCor: string;
  ultimaMensagem: string;
  ultimaMensagemEm: string | null;
  naoLidas: number;
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

export async function listarConversas(
  client: RedeClient
): Promise<ConversaResumo[]> {
  const userId = await obterUsuarioId(client);

  const { data: minhasParticipacoes, error } = await client
    .from("rede_conversas_participantes")
    .select("conversa_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const conversaIds = (minhasParticipacoes ?? []).map((p) => p.conversa_id);
  if (conversaIds.length === 0) {
    return [];
  }

  const [
    { data: participantes, error: participantesError },
    { data: mensagens, error: mensagensError },
  ] = await Promise.all([
    client
      .from("rede_conversas_participantes")
      .select("conversa_id,user_id")
      .in("conversa_id", conversaIds),
    client
      .from("rede_mensagens")
      .select("conversa_id,autor_id,texto,criado_em,lida_em")
      .in("conversa_id", conversaIds)
      .order("criado_em", { ascending: true }),
  ]);

  if (participantesError) {
    throw participantesError;
  }
  if (mensagensError) {
    throw mensagensError;
  }

  const outroPorConversa = new Map<string, string>();
  for (const p of participantes ?? []) {
    if (p.user_id !== userId) {
      outroPorConversa.set(p.conversa_id, p.user_id);
    }
  }

  const perfis = await buscarPerfisPorIds(
    client,
    Array.from(new Set(outroPorConversa.values()))
  );

  const ultimaPorConversa = new Map<
    string,
    { texto: string; criado_em: string }
  >();
  const naoLidasPorConversa = new Map<string, number>();
  for (const m of mensagens ?? []) {
    // Ordenado por criado_em asc -- a última sobrescrita ganha, então fica
    // com a mensagem mais recente sem precisar de outra query.
    ultimaPorConversa.set(m.conversa_id, {
      texto: m.texto,
      criado_em: m.criado_em,
    });
    if (m.autor_id !== userId && !m.lida_em) {
      naoLidasPorConversa.set(
        m.conversa_id,
        (naoLidasPorConversa.get(m.conversa_id) ?? 0) + 1
      );
    }
  }

  return conversaIds
    .map((id) => {
      const outroId = outroPorConversa.get(id);
      const perfil = outroId ? perfis.get(outroId) : undefined;
      if (!outroId || !perfil) {
        return null;
      }
      const ultima = ultimaPorConversa.get(id);
      return {
        id,
        outroUserId: outroId,
        outroNome: perfil.nome,
        outroCor: perfil.cor,
        ultimaMensagem: ultima?.texto ?? "",
        ultimaMensagemEm: ultima?.criado_em ?? null,
        naoLidas: naoLidasPorConversa.get(id) ?? 0,
      };
    })
    .filter((c): c is ConversaResumo => !!c)
    .sort((a, b) =>
      (b.ultimaMensagemEm ?? "").localeCompare(a.ultimaMensagemEm ?? "")
    );
}

export async function listarMensagens(
  client: RedeClient,
  conversaId: string
): Promise<MensagemChat[]> {
  const userId = await obterUsuarioId(client);
  const { data, error } = await client
    .from("rede_mensagens")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("criado_em", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    autorId: m.autor_id,
    texto: m.texto,
    criadoEm: m.criado_em,
    lidaEm: m.lida_em,
    deMim: m.autor_id === userId,
  }));
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
