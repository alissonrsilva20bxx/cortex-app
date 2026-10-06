/**
 * Cache da "Sua Jornada" (J11, #161) — mesmo padrão SWR de
 * `lib/cofre/cofreCache.ts` e `lib/rede/redeCache.ts`: memória (módulo) +
 * uma camada persistida em `localStorage` (`jobapp-jornada:<userId>`), por
 * conta, com época pra descartar resposta atrasada de outra conta.
 *
 * Três coisas ficam guardadas, todas por conta:
 *
 *  - **o último estado** que o servidor mandou (pra a tela abrir na hora e
 *    revalidar em silêncio);
 *  - **a fila de comemoração pendente** — persiste de propósito: se o app
 *    fechar com comemoração na fila, ela aparece na próxima abertura (é o
 *    mecanismo que adia a comemoração grande do atendimento, #161);
 *  - **os registros ainda não enviados** — se a chamada da Jornada falhou
 *    (sem rede), o pedido fica aqui, com a mesma chave de idempotência, até
 *    ser entregue. A ação principal da usuária nunca depende disto.
 *
 * Nenhum diário: só o retrato atual do estado, a fila e pedidos ainda não
 * entregues (spec, §8).
 *
 * Defensivo: SSR, aba anônima, storage desabilitado, cota estourada ou JSON
 * corrompido degradam pra "sem cache persistido", nunca lançam.
 */

import {
  ehComemoracao,
  ehEstadoJornada,
  ehPedidoRegistro,
  type Comemoracao,
  type EstadoJornada,
  type PedidoRegistro,
} from "./estado";

/** O que o cache usa do `localStorage` (injetável no teste). */
export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
  key(indice: number): string | null;
  readonly length: number;
}

export interface Retrato {
  estado: EstadoJornada | null;
  fila: Comemoracao[];
  pendentes: PedidoRegistro[];
}

const PREFIXO = "jobapp-jornada:";
// "v2": o estado passou a ter periodos e glowInicioEstagio obrigatórios;
// cache gravado na versão anterior é descartado e a tela recarrega do servidor.
const VERSAO = "v2";

const mem = new Map<string, Retrato>(); // userId -> retrato
let armazenamentoInjetado: Armazenamento | null | undefined;
let usuarioVinculado: string | null = null;
let epoca = 0;

function armazenamento(): Armazenamento | null {
  if (armazenamentoInjetado !== undefined) return armazenamentoInjetado;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Retrato vazio constante: a mesma referência sempre (o `useSyncExternalStore` exige). */
const VAZIO: Retrato = Object.freeze({
  estado: null,
  fila: Object.freeze([]) as unknown as Comemoracao[],
  pendentes: Object.freeze([]) as unknown as PedidoRegistro[],
});

function vazio(): Retrato {
  return { estado: null, fila: [], pendentes: [] };
}

// ─────────────────────────── camada persistida ───────────────────────────

function lerDisco(userId: string): Retrato | null {
  try {
    const s = armazenamento();
    if (!s) return null;
    const raw = s.getItem(PREFIXO + userId);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.v !== VERSAO || p.userId !== userId) return null;
    return {
      estado: ehEstadoJornada(p.estado) ? p.estado : null,
      fila: Array.isArray(p.fila) ? p.fila.filter(ehComemoracao) : [],
      pendentes: Array.isArray(p.pendentes)
        ? p.pendentes.filter(ehPedidoRegistro)
        : [],
    };
  } catch {
    return null;
  }
}

function gravarDisco(userId: string, r: Retrato): void {
  try {
    const s = armazenamento();
    if (!s) return;
    s.setItem(
      PREFIXO + userId,
      JSON.stringify({
        v: VERSAO,
        userId,
        estado: r.estado,
        fila: r.fila,
        pendentes: r.pendentes,
      })
    );
  } catch {
    /* cota/storage indisponível: fica só a memória */
  }
}

function apagarDisco(): void {
  try {
    const s = armazenamento();
    if (!s) return;
    const chaves: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k);
    }
    chaves.forEach((k) => s.removeItem(k));
  } catch {
    /* nada a fazer */
  }
}

// ─────────────────────────── conta / época ──────────────────────────────

function contaOk(userId: string): boolean {
  if (usuarioVinculado === null) {
    usuarioVinculado = userId;
    return true;
  }
  return usuarioVinculado === userId;
}

/** Trocar de conta limpa a memória e avança a época. */
export function vincularUsuario(userId: string): void {
  if (usuarioVinculado === userId) return;
  if (usuarioVinculado !== null) {
    mem.clear();
    epoca += 1;
  }
  usuarioVinculado = userId;
}

/** Capture no início de um pedido ao servidor e repasse pra gravação. */
export function epocaAtual(): number {
  return epoca;
}

/** Logout: zera memória E disco (todas as contas) e avança a época. */
export function limparTudo(): void {
  mem.clear();
  apagarDisco();
  epoca += 1;
}

// ────────────────────────────── leitura/escrita ─────────────────────────

/** Retrato da conta (memória; se vazia, hidrata do disco). Conta errada = vazio. */
export function ler(userId: string): Retrato {
  if (!contaOk(userId)) return VAZIO;
  let r = mem.get(userId);
  if (!r) {
    r = lerDisco(userId) ?? vazio();
    mem.set(userId, r);
  }
  return r;
}

/**
 * Grava uma mudança no retrato da conta, na memória e no disco. Ignorada se
 * a conta não é a vinculada ou se a época capturada já passou.
 */
export function atualizar(
  userId: string,
  mudar: (atual: Retrato) => Retrato,
  atEpoca?: number
): Retrato | null {
  if (!contaOk(userId)) return null;
  if (atEpoca !== undefined && atEpoca !== epoca) return null;
  const novo = mudar(ler(userId));
  mem.set(userId, novo);
  gravarDisco(userId, novo);
  return novo;
}

/** Só pra teste — usa este armazenamento (ou `null` = sem disco). */
export function _usarArmazenamentoParaTeste(s: Armazenamento | null): void {
  armazenamentoInjetado = s;
}

/** Só pra teste — esquece a memória, como se o app tivesse fechado. O disco fica. */
export function _fecharAppParaTeste(): void {
  mem.clear();
  usuarioVinculado = null;
}

/** Só pra teste — reseta o módulo ao estado inicial (memória e disco). */
export function _resetParaTeste(): void {
  mem.clear();
  apagarDisco();
  usuarioVinculado = null;
  epoca = 0;
}
