/**
 * Webhook do Stripe: a verificação da assinatura (o cabeçalho
 * `Stripe-Signature`) e a tradução do evento em atualização de
 * `configuracoes.assinatura_status`. Sem SDK do Stripe (o pacote não está
 * instalado): o esquema é o documentado pelo Stripe,
 *
 *   Stripe-Signature: t=<segundos>,v1=<hex>[,v1=<hex>…][,v0=…]
 *   v1 = HMAC-SHA256(segredo do endpoint, "<t>.<corpo cru>")
 *
 * e o evento só vale se algum `v1` bate (comparação em tempo constante) e
 * `t` está a até 5 minutos do relógio do servidor (contra reenvio).
 * Testado com um Stripe simulado em tests/lib/pagamentoWebhook.test.ts.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AssinaturaStatus } from "@/lib/types";
import { assinaturaValendo, type AssinaturaDoStripe } from "./regras";

/** Tolerância do carimbo de tempo, em segundos (o padrão do Stripe). */
export const TOLERANCIA_SEGUNDOS = 300;

export type ResultadoDaVerificacao =
  | { ok: true }
  | {
      ok: false;
      motivo: "sem-cabecalho" | "malformado" | "fora-do-prazo" | "nao-confere";
    };

/** A assinatura que o Stripe calcula para `corpo` no instante `t`. */
export function assinarComoStripe(
  corpo: string,
  t: number,
  segredo: string
): string {
  return createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex");
}

function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Confere o cabeçalho `Stripe-Signature` contra o corpo CRU da requisição. */
export function verificarAssinaturaDoStripe(
  corpo: string,
  cabecalho: string | null | undefined,
  segredo: string,
  agoraSegundos: number = Math.floor(Date.now() / 1000),
  tolerancia: number = TOLERANCIA_SEGUNDOS
): ResultadoDaVerificacao {
  if (!cabecalho) return { ok: false, motivo: "sem-cabecalho" };
  let t: number | null = null;
  const v1: string[] = [];
  for (const parte of cabecalho.split(",")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const chave = parte.slice(0, i).trim();
    const valor = parte.slice(i + 1).trim();
    if (chave === "t" && /^\d+$/.test(valor)) t = Number(valor);
    else if (chave === "v1" && /^[0-9a-f]+$/i.test(valor)) v1.push(valor);
  }
  if (t == null || v1.length === 0) return { ok: false, motivo: "malformado" };
  if (Math.abs(agoraSegundos - t) > tolerancia)
    return { ok: false, motivo: "fora-do-prazo" };
  const esperado = assinarComoStripe(corpo, t, segredo);
  return v1.some((v) => iguaisEmTempoConstante(v.toLowerCase(), esperado))
    ? { ok: true }
    : { ok: false, motivo: "nao-confere" };
}

/** Os eventos que mudam a assinatura no app. */
export const EVENTOS_DA_ASSINATURA = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export interface AtualizacaoDaAssinatura {
  userId: string;
  assinaturaStatus: AssinaturaStatus;
}

interface EventoDoStripe {
  type?: unknown;
  data?: { object?: AssinaturaDoStripe };
}

/** A cliente do Stripe dona da assinatura do evento (para listar as outras). */
export function clienteDoEvento(evento: EventoDoStripe): string | null {
  const c = evento.data?.object?.customer;
  return typeof c === "string" && c.length > 0 ? c : null;
}

/**
 * O que o evento muda: a conta (o `user_id` que a rota de assinatura grava
 * no metadata) e o novo `assinatura_status`, olhando TODAS as assinaturas
 * da cliente (`daCliente`, listadas no Stripe na hora), não só a do evento:
 *
 *  - alguma sustenta "ativa" (`assinaturaValendo`): "ativa". Assim uma
 *    assinatura velha que expira, é cancelada ou fica sem cartão nunca
 *    rebaixa quem pagou em outra;
 *  - nenhuma, e a do evento foi apagada, cancelada ou ficou `unpaid`:
 *    "trial" (o `computeAssinatura` decide pela data se o teste ainda vale);
 *  - nenhuma, e a do evento é `incomplete`, `incomplete_expired`, `paused`
 *    ou `trialing` sem cartão: nada muda (nunca deu "ativa").
 *
 * `null` quando o evento não é da assinatura ou não diz de quem é.
 */
export function atualizacaoDoEvento(
  evento: EventoDoStripe,
  daCliente: readonly AssinaturaDoStripe[] = []
): AtualizacaoDaAssinatura | null {
  if (
    typeof evento.type !== "string" ||
    !(EVENTOS_DA_ASSINATURA as readonly string[]).includes(evento.type)
  )
    return null;
  const assinatura = evento.data?.object;
  const userId = assinatura?.metadata?.user_id;
  if (typeof userId !== "string" || userId.trim().length === 0) return null;
  const apagada = evento.type === "customer.subscription.deleted";
  // A lista do Stripe é a foto de agora; a do evento entra se não estiver
  // nela (apagada ou ainda não visível na listagem).
  const todas = [
    ...daCliente,
    ...(daCliente.some((s) => s.id && s.id === assinatura?.id)
      ? []
      : [apagada ? { ...assinatura, status: "canceled" } : (assinatura ?? {})]),
  ];
  if (todas.some(assinaturaValendo))
    return { userId, assinaturaStatus: "ativa" };
  if (
    apagada ||
    assinatura?.status === "canceled" ||
    assinatura?.status === "unpaid"
  )
    return { userId, assinaturaStatus: "trial" };
  return null;
}
