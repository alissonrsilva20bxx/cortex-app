import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import { buscarPerfisPorIds, type PessoaResumo } from "./perfis";

type RedeClient = SupabaseClient<Database>;

export type TipoNotificacao =
  | "curtida"
  | "comentario"
  | "solicitacao"
  | "mensagem";

export type DestinoNotificacao =
  | { tipo: "post"; postId: string }
  | { tipo: "perfil"; userId: string }
  | { tipo: "conversa"; conversaId: string };

/** Notificacao agregada -- nao existe tabela propria (ver migration 0016).
 * `lida` de curtida/comentario/solicitacao vem do cursor unico
 * `notificacoes_vistas_em`; `lida` de mensagem segue o `lida_em` real da
 * mensagem (so aparece aqui enquanto nao lida, ver marcarNotificacoesVistas). */
export type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  pessoa: PessoaResumo;
  texto: string;
  criadoEm: string;
  lida: boolean;
  destino: DestinoNotificacao;
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

export async function listarNotificacoes(
  client: RedeClient
): Promise<Notificacao[]> {
  const userId = await obterUsuarioId(client);

  const [
    { data: perfil, error: perfilError },
    { data: meusPosts, error: postsError },
    { data: minhasParticipacoes, error: participacoesError },
    { data: solicitacoes, error: solicitacoesError },
  ] = await Promise.all([
    client
      .from("rede_perfis")
      .select("notificacoes_vistas_em")
      .eq("user_id", userId)
      .maybeSingle(),
    client.from("rede_posts").select("id").eq("autor_id", userId),
    client
      .from("rede_conversas_participantes")
      .select("conversa_id")
      .eq("user_id", userId),
    client
      .from("rede_amizades")
      .select("id,solicitante_id,criado_em")
      .eq("destinatario_id", userId)
      .eq("status", "pendente"),
  ]);

  if (perfilError) {
    throw perfilError;
  }
  if (postsError) {
    throw postsError;
  }
  if (participacoesError) {
    throw participacoesError;
  }
  if (solicitacoesError) {
    throw solicitacoesError;
  }

  const vistoEm = perfil?.notificacoes_vistas_em ?? null;
  const postIds = (meusPosts ?? []).map((p) => p.id);
  const conversaIds = (minhasParticipacoes ?? []).map((p) => p.conversa_id);

  const [
    { data: curtidas, error: curtidasError },
    { data: comentarios, error: comentariosError },
  ] =
    postIds.length > 0
      ? await Promise.all([
          client
            .from("rede_curtidas")
            .select("post_id,user_id,criado_em")
            .in("post_id", postIds),
          client
            .from("rede_comentarios")
            .select("id,post_id,autor_id,texto,criado_em")
            .in("post_id", postIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (curtidasError) {
    throw curtidasError;
  }
  if (comentariosError) {
    throw comentariosError;
  }

  const [
    { data: participantes, error: participantesError },
    { data: mensagens, error: mensagensError },
  ] =
    conversaIds.length > 0
      ? await Promise.all([
          client
            .from("rede_conversas_participantes")
            .select("conversa_id,user_id")
            .in("conversa_id", conversaIds),
          client
            .from("rede_mensagens")
            .select("conversa_id,autor_id,texto,criado_em,lida_em")
            .in("conversa_id", conversaIds)
            .order("criado_em", { ascending: true }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

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

  // Ultima mensagem nao lida por conversa -- ordenado por criado_em asc,
  // a ultima sobrescrita ganha, sem precisar de outra query.
  const ultimaNaoLidaPorConversa = new Map<
    string,
    { texto: string; criado_em: string }
  >();
  for (const m of mensagens ?? []) {
    if (m.autor_id === userId || m.lida_em) continue;
    ultimaNaoLidaPorConversa.set(m.conversa_id, {
      texto: m.texto,
      criado_em: m.criado_em,
    });
  }

  const curtidasDeOutros = (curtidas ?? []).filter((c) => c.user_id !== userId);
  const comentariosDeOutros = (comentarios ?? []).filter(
    (c) => c.autor_id !== userId
  );

  const idsPessoas = new Set<string>();
  for (const c of curtidasDeOutros) idsPessoas.add(c.user_id);
  for (const c of comentariosDeOutros) idsPessoas.add(c.autor_id);
  for (const s of solicitacoes ?? []) idsPessoas.add(s.solicitante_id);
  for (const conversaId of ultimaNaoLidaPorConversa.keys()) {
    const outroId = outroPorConversa.get(conversaId);
    if (outroId) idsPessoas.add(outroId);
  }

  const perfis = await buscarPerfisPorIds(client, Array.from(idsPessoas));

  const lidaPorTimestamp = (criadoEm: string) =>
    vistoEm !== null && criadoEm <= vistoEm;

  const notificacoes: Notificacao[] = [];

  for (const c of curtidasDeOutros) {
    const pessoa = perfis.get(c.user_id);
    if (!pessoa) continue;
    notificacoes.push({
      id: `curtida:${c.post_id}:${c.user_id}`,
      tipo: "curtida",
      pessoa,
      texto: "curtiu sua publicação",
      criadoEm: c.criado_em,
      lida: lidaPorTimestamp(c.criado_em),
      destino: { tipo: "post", postId: c.post_id },
    });
  }

  for (const c of comentariosDeOutros) {
    const pessoa = perfis.get(c.autor_id);
    if (!pessoa) continue;
    notificacoes.push({
      id: `comentario:${c.id}`,
      tipo: "comentario",
      pessoa,
      texto: `comentou: "${c.texto}"`,
      criadoEm: c.criado_em,
      lida: lidaPorTimestamp(c.criado_em),
      destino: { tipo: "post", postId: c.post_id },
    });
  }

  for (const s of solicitacoes ?? []) {
    const pessoa = perfis.get(s.solicitante_id);
    if (!pessoa) continue;
    notificacoes.push({
      id: `solicitacao:${s.id}`,
      tipo: "solicitacao",
      pessoa,
      texto: "quer ser sua amiga",
      criadoEm: s.criado_em,
      lida: lidaPorTimestamp(s.criado_em),
      destino: { tipo: "perfil", userId: s.solicitante_id },
    });
  }

  for (const [conversaId, ultima] of ultimaNaoLidaPorConversa) {
    const outroId = outroPorConversa.get(conversaId);
    const pessoa = outroId ? perfis.get(outroId) : undefined;
    if (!pessoa) continue;
    notificacoes.push({
      id: `mensagem:${conversaId}`,
      tipo: "mensagem",
      pessoa,
      texto: ultima.texto,
      criadoEm: ultima.criado_em,
      // Nunca "lida" aqui -- so entra na lista enquanto houver mensagem
      // sem lida_em; abrir a conversa (fluxo já existente) marca a
      // mensagem como lida de verdade e ela some daqui na próxima busca.
      lida: false,
      destino: { tipo: "conversa", conversaId },
    });
  }

  return notificacoes.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Avança o cursor de "vistas até aqui" -- só afeta curtida/comentário/
 * solicitação; notificação de mensagem só some abrindo a conversa (tem
 * leitura real própria, ver `marcarMensagemComoLida`). */
export async function marcarNotificacoesVistas(
  client: RedeClient
): Promise<void> {
  const userId = await obterUsuarioId(client);
  const { error } = await client
    .from("rede_perfis")
    .update({ notificacoes_vistas_em: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
