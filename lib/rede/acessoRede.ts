import {
  AuthRetryableFetchError,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { diasDoTeste } from "../assinatura";
import type { Database } from "../database.types";

type RedeClient = SupabaseClient<Database>;

/**
 * Quem entra na Rede (decisão do capitão, 27/10): durante o teste grátis
 * todas entram, sem código e sem fila; depois do teste, só com a
 * assinatura ativa. O resto do app nunca bloqueia (`AssinaturaNoApp`).
 * Quem já tinha entrado por convite antes continua entrando (decisão N4
 * da revisão R17rev): o convite usado vale como garantia, e nenhum
 * convite novo é criado.
 *
 * Este arquivo é a regra ÚNICA do app: a tela (`RedeGatedTab`) e as rotas
 * `/api/rede/*` perguntam aqui. A mesma regra está no banco, em
 * `private.rede_usuario_e_membro` (migration 0049), que a RLS usa. Os dois
 * lados são conferidos com a MESMA tabela de casos
 * (`tests/rede/services/acessoRede.test.ts` e
 * `tests/rede/acesso-0049-pglite.mjs`).
 *
 * O fim do teste é contado em horas exatas (início + dias x 24 h), igual ao
 * SQL (`interval '24 hours'`), para a tela e o banco virarem no mesmo
 * instante. A pílula do Início (`computeAssinatura`) soma dias no relógio
 * local: na semana da troca de horário as duas podem diferir em até 1 h.
 */
export type PorOndeEntra = "assinatura" | "teste" | "convite";

export type RegraAcessoRede =
  | { liberado: true; por: PorOndeEntra; validoAte: number | null }
  | { liberado: false };

export interface DadosAcessoRede {
  /** `configuracoes.assinatura_status`; null = sem linha. */
  assinaturaStatus: string | null;
  /** `configuracoes.trial_started_at`; null = sem linha. */
  trialStartedAt: string | null;
  /** Já tinha um convite usado antes de o código acabar. */
  temConvite: boolean;
}

const HORA_MS = 60 * 60 * 1000;

/** Até quando vale o teste desta conta (ms), ou null se a data é ilegível. */
export function fimDoTesteMs(trialStartedAt: string): number | null {
  const inicio = new Date(trialStartedAt).getTime();
  if (Number.isNaN(inicio)) return null;
  return inicio + diasDoTeste(trialStartedAt) * 24 * HORA_MS;
}

/** A regra pura: assinatura ativa, teste em dia ou convite usado. */
export function regraAcessoRede(
  dados: DadosAcessoRede,
  agora: number = Date.now()
): RegraAcessoRede {
  if (dados.assinaturaStatus === "ativa") {
    return { liberado: true, por: "assinatura", validoAte: null };
  }
  const fim = dados.trialStartedAt ? fimDoTesteMs(dados.trialStartedAt) : null;
  if (fim !== null && agora < fim) {
    return { liberado: true, por: "teste", validoAte: fim };
  }
  if (dados.temConvite) {
    return { liberado: true, por: "convite", validoAte: null };
  }
  return { liberado: false };
}

/**
 * Por que classificar pelo `status` e não só tratar o `catch`: com
 * `@supabase/postgrest-js` >= 2.x uma leitura (`GET`) **quase nunca REJEITA
 * a promise** quando o `fetch` falha. O cliente tenta 3 vezes (backoff
 * 1s/2s/4s, ~7s no total) e então RESOLVE com uma resposta sintética
 * `{ data: null, error: { message: "TypeError: fetch failed" }, status: 0 }`.
 *
 * `verificarAcessoRede` devolve `{ unlocked, motivo?, validoAte? }`:
 *
 *  | resposta                              | retorno                             | o gate faz                          |
 *  |--------------------------------------|-------------------------------------|-------------------------------------|
 *  | 200 + regra libera                   | { unlocked: true, validoAte }       | libera; carimba o acesso confirmado |
 *  | 200 + regra não libera               | { unlocked: false, "vencido" }      | DERRUBA: tela de renovação          |
 *  | status 0 (fetch não chegou) / >= 500 | { unlocked: false, "indisponivel" } | preserva SÓ dentro do teto de 24 h  |
 *  | status 401 (JWT) e NÃO recuperou     | { unlocked: false, "sessao" }       | DERRUBA                             |
 *  | status 403 / demais 4xx             | { unlocked: false, "negado" }       | DERRUBA (não presume transitório)   |
 *
 * `401`: antes de desistir, tenta `auth.refreshSession()` uma vez. Falha de
 * REDE no próprio refresh (`AuthRetryableFetchError`) é `"indisponivel"`,
 * não `"sessao"`: uma reconexão instável do iOS não pode derrubar o acesso
 * lembrado como se a sessão tivesse sido perdida.
 *
 * Isto é só a TELA: cada consulta da Rede passa pela RLS do servidor
 * (`rede_is_member()`), que decide de verdade.
 */
export type AcessoMotivo = "vencido" | "indisponivel" | "sessao" | "negado";

export type AcessoRede = {
  unlocked: boolean;
  motivo?: AcessoMotivo;
  /** Liberado pelo teste: o instante (ms) em que ele acaba. */
  validoAte?: number;
};

type Resposta<T> = { data: T | null; error: unknown; status: number };

type Consulta = {
  config: Resposta<{
    assinatura_status: string | null;
    trial_started_at: string | null;
  }>;
  convite: Resposta<{ id: string }[]>;
};

async function consultar(
  client: RedeClient,
  usuarioId: string
): Promise<Consulta> {
  const [config, convite] = await Promise.all([
    client
      .from("configuracoes")
      .select("assinatura_status, trial_started_at")
      .eq("user_id", usuarioId)
      .maybeSingle() as unknown as PromiseLike<Consulta["config"]>,
    client
      .from("rede_convites")
      .select("id")
      .eq("usado_por", usuarioId)
      .limit(1) as unknown as PromiseLike<Consulta["convite"]>,
  ]);
  return { config, convite };
}

function classificarErro(status: number): AcessoMotivo {
  if (status === 0 || status >= 500) return "indisponivel";
  if (status === 401) return "sessao";
  return "negado"; // 403 e demais 4xx: fail-closed, não presume transitório
}

/** A resposta com erro que decide (a mais grave das duas), ou null. */
function erroDaConsulta(c: Consulta): { status: number; error: unknown } | null {
  const comErro = [c.config, c.convite].filter((r) => r.error);
  if (comErro.length === 0) return null;
  // indisponível pesa menos que uma negativa decisiva: se uma das duas
  // disse 401/403, é isso que vale.
  const decisiva = comErro.find(
    (r) => classificarErro(r.status) !== "indisponivel"
  );
  return decisiva ?? comErro[0];
}

function avaliar(c: Consulta, agora: number): AcessoRede {
  const erro = erroDaConsulta(c);
  if (erro) return { unlocked: false, motivo: classificarErro(erro.status) };
  const regra = regraAcessoRede(
    {
      assinaturaStatus: c.config.data?.assinatura_status ?? null,
      trialStartedAt: c.config.data?.trial_started_at ?? null,
      temConvite: Boolean(c.convite.data && c.convite.data.length > 0),
    },
    agora
  );
  if (!regra.liberado) return { unlocked: false, motivo: "vencido" };
  return regra.validoAte === null
    ? { unlocked: true }
    : { unlocked: true, validoAte: regra.validoAte };
}

/** Nunca rejeita -- toda falha vira `{ unlocked: false, motivo }`
 * (fail-closed) em vez de deixar o chamador preso numa promise. */
export async function verificarAcessoRede(
  client: RedeClient,
  usuarioId: string,
  agora: () => number = Date.now
): Promise<AcessoRede> {
  let c: Consulta;
  try {
    c = await consultar(client, usuarioId);
  } catch (e) {
    // Salvaguarda: cliente que REJEITA de fato (mock, throw síncrono).
    console.warn("[verificarAcessoRede] promise rejeitada", e);
    return { unlocked: false, motivo: "indisponivel" };
  }

  // 401: tenta recuperar a sessão UMA vez antes de desistir.
  if (erroDaConsulta(c)?.status === 401) {
    const { data, error } = await client.auth.refreshSession().catch((e) => ({
      data: { session: null },
      error: e instanceof Error ? e : new Error("refresh"),
    }));
    if (error) {
      if (error instanceof AuthRetryableFetchError) {
        console.warn(
          "[verificarAcessoRede] refreshSession falhou por rede (401)",
          error
        );
        return { unlocked: false, motivo: "indisponivel" };
      }
      console.warn("[verificarAcessoRede] sessão não recuperada (401)", error);
      return { unlocked: false, motivo: "sessao" };
    }
    if (!data?.session) {
      console.warn("[verificarAcessoRede] sessão não recuperada (401)");
      return { unlocked: false, motivo: "sessao" };
    }
    try {
      c = await consultar(client, usuarioId);
    } catch (e) {
      console.warn("[verificarAcessoRede] promise rejeitada pós-refresh", e);
      return { unlocked: false, motivo: "indisponivel" };
    }
  }

  const resultado = avaliar(c, agora());
  if (resultado.motivo && resultado.motivo !== "vencido") {
    console.warn(`[verificarAcessoRede] ${resultado.motivo}`);
  }
  return resultado;
}

/** Para as rotas `/api/rede/*`: a recusa (status HTTP + mensagem) ou null
 * se pode seguir. Sem `NextResponse` aqui: o arquivo também roda na tela. */
export function recusaDaRota(
  acesso: AcessoRede
): { status: number; error: string } | null {
  if (acesso.unlocked) return null;
  if (acesso.motivo === "indisponivel") {
    return { status: 503, error: "Não foi possível verificar o acesso à Rede" };
  }
  if (acesso.motivo === "sessao") {
    return { status: 401, error: "Não autenticado" };
  }
  return { status: 403, error: "Sem acesso à Rede" };
}
