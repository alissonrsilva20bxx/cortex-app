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
  outroFotoUrl: string | null;
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

type MensagemReconciliavel = {
  id: string;
  texto: string;
  deMim: boolean;
  status?: "sending" | "error";
};

/** Reconcilia uma mensagem confirmada (por REST ou por eco do Realtime, em
 * qualquer ordem de chegada) contra a lista atual de mensagens de uma
 * conversa, sem duplicar. `assinarMensagensConversa` entrega de volta pro
 * próprio remetente o INSERT das mensagens que ele mesmo mandou (necessário
 * pra sincronizar outra aba/sessão do mesmo usuário) -- sem essa
 * reconciliação, a mensagem otimista local (id temporário, status
 * "sending") e o eco do Realtime (id real) viram duas bolhas.
 *
 * `localId`, quando informado (chamada vinda da confirmação REST do próprio
 * envio), casa direto pelo id local. Sem `localId` (chamada vinda do
 * Realtime), casa pela primeira mensagem própria ainda pendente (status
 * "sending" OU "error") com o mesmo texto -- ordem de chegada FIFO, cobre
 * inclusive dois envios idênticos em sequência. Casar "error" também é
 * necessário: se o `enviarMensagem` perder a confirmação por queda de rede
 * mas o insert já tiver ido pro banco, a mensagem local vira "error" antes
 * do eco do Realtime chegar -- sem casar contra "error" também, esse eco
 * tardio vira uma segunda bolha ao lado da que ficou travada como falha. */
export function reconcileConfirmedMessage<T extends MensagemReconciliavel>(
  atual: T[],
  confirmed: T,
  localId?: string
): T[] {
  if (atual.some((m) => m.id === confirmed.id)) {
    return atual;
  }

  const idx = atual.findIndex((m) =>
    localId
      ? m.id === localId
      : (m.status === "sending" || m.status === "error") &&
        m.deMim === confirmed.deMim &&
        m.texto === confirmed.texto
  );

  if (idx === -1) {
    return [...atual, confirmed];
  }

  const next = [...atual];
  next[idx] = confirmed;
  return next;
}

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

/**
 * Issue #54: buscava todas as mensagens de todas as conversas só pra
 * reduzir, em memória, à última mensagem de cada uma (e contar não
 * lidas). Agregação movida pro banco (`rede_listar_resumo_conversas`,
 * migration 0022) -- uma linha por conversa, sem trazer mensagem nenhuma
 * que não seja a mais recente.
 */
type ResumoConversaRow = {
  conversa_id: string;
  outro_user_id: string;
  // Os tipos gerados marcam essas duas como não-nulas, mas a migration
  // 0022 as produz via LEFT JOIN LATERAL -- uma conversa sem nenhuma
  // mensagem ainda (par recém-criado) devolve null pra ambas.
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  nao_lidas: number;
};

export async function listarConversas(
  client: RedeClient
): Promise<ConversaResumo[]> {
  const { data, error } = await client.rpc("rede_listar_resumo_conversas");

  if (error) {
    throw error;
  }

  // Issue #55: conversas ocultadas (excluir conversa) já vêm filtradas
  // pela própria RPC (migration 0024) -- reaparecem sozinhas se a outra
  // pessoa mandar mensagem depois da exclusão, sem nenhuma ação de
  // "desocultar". Nada a fazer aqui além de mapear o que a RPC devolveu.
  const rows = data as ResumoConversaRow[];
  const perfis = await buscarPerfisPorIds(
    client,
    Array.from(new Set(rows.map((r) => r.outro_user_id)))
  );

  return rows
    .map((r) => {
      const perfil = perfis.get(r.outro_user_id);
      if (!perfil) {
        return null;
      }
      return {
        id: r.conversa_id,
        outroUserId: r.outro_user_id,
        outroNome: perfil.nome,
        outroCor: perfil.cor,
        outroFotoUrl: perfil.fotoUrl,
        ultimaMensagem: r.ultima_mensagem ?? "",
        ultimaMensagemEm: r.ultima_mensagem_em,
        naoLidas: r.nao_lidas,
      };
    })
    .filter((c): c is ConversaResumo => !!c)
    .sort((a, b) =>
      (b.ultimaMensagemEm ?? "").localeCompare(a.ultimaMensagemEm ?? "")
    );
}

export type OcultarConversaInput = {
  conversaId: string;
};

/** Issue #55: "excluir conversa" -- esconde só do lado de quem chama. */
export async function ocultarConversa(
  client: RedeClient,
  input: OcultarConversaInput
): Promise<void> {
  const { error } = await client.rpc("rede_ocultar_conversa", {
    alvo_conversa_id: input.conversaId,
  });

  if (error) {
    throw error;
  }
}

/** Tamanho de página padrão de `listarMensagens` (issue #54). */
export const MENSAGENS_PAGE_SIZE = 30;

export type ListarMensagensOptions = {
  /** Máximo de mensagens retornadas. */
  limit?: number;
  /** Cursor de paginação -- busca só mensagens estritamente mais antigas
   * que este `criado_em` (ISO). Omitido = página mais recente. */
  antesDe?: string;
};

/**
 * Issue #54: buscava o histórico inteiro da conversa toda vez que a tela
 * abria, sem paginação. Agora busca só a página mais recente (ou, com
 * `antesDe`, a página anterior a um cursor) -- sempre devolvida em ordem
 * cronológica ascendente (mais antiga primeiro), igual antes.
 */
export async function listarMensagens(
  client: RedeClient,
  conversaId: string,
  options: ListarMensagensOptions = {}
): Promise<MensagemChat[]> {
  const userId = await obterUsuarioId(client);
  let query = client
    .from("rede_mensagens")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("criado_em", { ascending: false })
    .limit(options.limit ?? MENSAGENS_PAGE_SIZE);

  if (options.antesDe) {
    query = query.lt("criado_em", options.antesDe);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((m) => ({
      id: m.id,
      autorId: m.autor_id,
      texto: m.texto,
      criadoEm: m.criado_em,
      lidaEm: m.lida_em,
      deMim: m.autor_id === userId,
    }))
    .reverse();
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
