/**
 * Camada cliente da "Sua Jornada" (J11, #161): o único lugar por onde a
 * Jornada é lida e as ações são registradas.
 *
 * O cliente NÃO decide nada. Não sabe quanto vale uma ação, nem o limite do
 * dia, nem o corte de estágio. Ele manda a ação, recebe o estado e a fila de
 * comemoração que o servidor (J10) decidiu, guarda e mostra.
 *
 * Garantias:
 *  - **A Jornada nunca é o caminho crítico.** `registrar` nunca lança. Se a
 *    chamada falhar, o pedido fica guardado (com a mesma chave de
 *    idempotência) e é reenviado depois; a ação principal da usuária
 *    (despesa, comprovante...) já valeu antes de chegar aqui.
 *  - **A fila de comemoração persiste** entre aberturas do app (`cache.ts`).
 *  - **Seguro a montar duas vezes** (StrictMode): `carregar` e
 *    `enviarPendentes` reaproveitam a chamada em andamento; registrar só
 *    acontece quando a tela chama `registrar`, nunca num efeito.
 *  - **Chamada duplicada não conta duas vezes:** todo pedido leva uma chave
 *    de idempotência, e o reenvio usa a mesma chave.
 */

import { supabase } from "@/lib/supabase";
import * as cache from "./cache";
import {
  ehComemoracao,
  ehEstadoJornada,
  type Acao,
  type Comemoracao,
  type ErroJornada,
  type EstadoJornada,
  type PedidoRegistro,
  type RespostaRegistro,
  type TransporteJornada,
} from "./estado";

// ─────────────────────────── fuso da usuária ───────────────────────────

/** Fuso IANA e deslocamento atual (minutos a somar ao UTC). */
export function fusoDaUsuaria(agora: Date = new Date()): {
  fuso: string;
  deslocamentoMin: number;
} {
  let fuso = "UTC";
  try {
    fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    /* sem Intl: fica UTC e o deslocamento abaixo resolve */
  }
  return { fuso, deslocamentoMin: -agora.getTimezoneOffset() };
}

// ─────────────────────── transporte (Supabase / J10) ───────────────────

/**
 * As RPCs da J10. É o único trecho do app que sabe os nomes e o formato do
 * servidor; se a J10 mudar o contrato, só isto muda.
 *
 *  - `jornada_estado(p_fuso, p_deslocamento_min)` → EstadoJornada
 *  - `jornada_registrar(p_acao, p_chave, p_fuso, p_deslocamento_min)`
 *      → { estado: EstadoJornada, comemoracoes: Comemoracao[] }
 *
 * A usuária é sempre a do `auth.uid()` no servidor; nenhum id vai daqui.
 */
/**
 * As RPCs da J10 ainda não existem em `lib/database.types.ts` (gerado do
 * banco), então o `rpc` tipado recusa o nome. Chamada sem tipo só aqui; a
 * resposta é conferida pela loja (`ehEstadoJornada`, `ehComemoracao`) antes
 * de ser usada. Quando a J10 regenerar os tipos, esta conversão pode sair.
 */
type RpcSemTipo = (
  funcao: string,
  args: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: unknown }>;

async function chamarRpc(
  funcao: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const rpc = supabase.rpc as unknown as RpcSemTipo;
  const { data, error } = await rpc.call(supabase, funcao, args);
  if (error) throw error;
  return data;
}

export const transporteSupabase: TransporteJornada = {
  async lerEstado(fuso, deslocamentoMin) {
    return (await chamarRpc("jornada_estado", {
      p_fuso: fuso,
      p_deslocamento_min: deslocamentoMin,
    })) as EstadoJornada;
  },
  async registrar(pedido) {
    return (await chamarRpc("jornada_registrar", {
      p_acao: pedido.acao,
      p_chave: pedido.chave,
      p_fuso: pedido.fuso,
      p_deslocamento_min: pedido.deslocamentoMin,
    })) as RespostaRegistro;
  },
};

// ─────────────────────────────── a loja ──────────────────────────────────

/** O que o hook (e qualquer tela) enxerga. */
export interface RetratoJornada {
  estado: EstadoJornada | null;
  carregando: boolean;
  erro: ErroJornada | null;
  /** Comemorações pendentes, na ordem do servidor. */
  fila: Comemoracao[];
  /** Quantos registros ainda esperam pra ser entregues ao servidor. */
  pendentes: number;
}

export interface LojaJornada {
  assinar(ouvinte: () => void): () => void;
  retrato(): RetratoJornada;
  carregar(): Promise<void>;
  registrar(acao: Acao): Promise<Comemoracao[]>;
  consumir(id: string): void;
  enviarPendentes(): Promise<void>;
}

export interface OpcoesLoja {
  userId: string;
  transporte?: TransporteJornada;
  /** Gera a chave de idempotência (injetável no teste). */
  gerarChave?: () => string;
  /** Fuso (injetável no teste). */
  fuso?: () => { fuso: string; deslocamentoMin: number };
}

function chaveAleatoria(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now()}${String(Math.random()).replace("0.", "-")}`;
}

/** Junta comemorações novas à fila, sem repetir id. */
function juntarFila(fila: Comemoracao[], novas: unknown[]): Comemoracao[] {
  const ids = new Set(fila.map((c) => c.id));
  const somar: Comemoracao[] = [];
  for (const c of novas) {
    if (!ehComemoracao(c) || ids.has(c.id)) continue;
    ids.add(c.id);
    somar.push(c);
  }
  return somar.length ? [...fila, ...somar] : fila;
}

export function criarLojaJornada(opcoes: OpcoesLoja): LojaJornada {
  const { userId } = opcoes;
  const transporte = opcoes.transporte ?? transporteSupabase;
  const gerarChave = opcoes.gerarChave ?? chaveAleatoria;
  const fuso = opcoes.fuso ?? (() => fusoDaUsuaria());

  const ouvintes = new Set<() => void>();
  let carregando = false;
  let erro: ErroJornada | null = null;
  let carregamento: Promise<void> | null = null;
  let envio: Promise<void> | null = null;
  /** Chaves sendo enviadas agora: o mesmo pedido nunca vai duas vezes ao mesmo tempo. */
  const emVoo = new Set<string>();
  let ultimo: RetratoJornada | null = null;

  function montarRetrato(): RetratoJornada {
    const r = cache.ler(userId);
    if (
      ultimo &&
      ultimo.estado === r.estado &&
      ultimo.fila === r.fila &&
      ultimo.pendentes === r.pendentes.length &&
      ultimo.carregando === carregando &&
      ultimo.erro === erro
    ) {
      return ultimo; // mesma referência: `useSyncExternalStore` não re-renderiza à toa
    }
    ultimo = {
      estado: r.estado,
      carregando,
      erro,
      fila: r.fila,
      pendentes: r.pendentes.length,
    };
    return ultimo;
  }

  function avisar() {
    ultimo = null;
    montarRetrato();
    ouvintes.forEach((f) => f());
  }

  /** Aplica a resposta do servidor a um pedido: estado novo, fila, tira o pendente. */
  function aplicarResposta(
    pedido: PedidoRegistro,
    resposta: RespostaRegistro,
    ep: number
  ): Comemoracao[] {
    const novas = Array.isArray(resposta?.comemoracoes)
      ? resposta.comemoracoes.filter(ehComemoracao)
      : [];
    cache.atualizar(
      userId,
      (r) => ({
        estado: ehEstadoJornada(resposta?.estado) ? resposta.estado : r.estado,
        fila: juntarFila(r.fila, novas),
        pendentes: r.pendentes.filter((p) => p.chave !== pedido.chave),
      }),
      ep
    );
    return novas;
  }

  async function enviar(pedido: PedidoRegistro): Promise<Comemoracao[] | null> {
    if (emVoo.has(pedido.chave)) return [];
    emVoo.add(pedido.chave);
    const ep = cache.epocaAtual();
    try {
      const resposta = await transporte.registrar(pedido);
      const novas = aplicarResposta(pedido, resposta, ep);
      erro = null;
      return novas;
    } catch {
      erro = "sem-conexao";
      return null;
    } finally {
      emVoo.delete(pedido.chave);
      avisar();
    }
  }

  const loja: LojaJornada = {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },

    retrato: montarRetrato,

    carregar() {
      if (carregamento) return carregamento; // montar duas vezes: uma chamada só
      carregando = cache.ler(userId).estado === null; // com cache, revalida em silêncio
      avisar();
      const ep = cache.epocaAtual();
      const { fuso: f, deslocamentoMin } = fuso();
      carregamento = transporte
        .lerEstado(f, deslocamentoMin)
        .then((estado) => {
          if (!ehEstadoJornada(estado)) {
            erro = "resposta-invalida";
            return;
          }
          cache.atualizar(userId, (r) => ({ ...r, estado }), ep);
          erro = null;
        })
        .catch(() => {
          erro = "sem-conexao"; // o estado em cache, se houver, continua na tela
        })
        .finally(() => {
          carregando = false;
          carregamento = null;
          avisar();
        });
      return carregamento;
    },

    async registrar(acao) {
      const { fuso: f, deslocamentoMin } = fuso();
      const pedido: PedidoRegistro = {
        acao,
        chave: gerarChave(),
        fuso: f,
        deslocamentoMin,
      };
      // Guarda ANTES de mandar: se o app fechar no meio, o pedido não se perde.
      cache.atualizar(userId, (r) => ({
        ...r,
        pendentes: [...r.pendentes, pedido],
      }));
      avisar();
      const novas = await enviar(pedido);
      return novas ?? [];
    },

    consumir(id) {
      cache.atualizar(userId, (r) => ({
        ...r,
        fila: r.fila.filter((c) => c.id !== id),
      }));
      avisar();
    },

    enviarPendentes() {
      if (envio) return envio; // montar duas vezes: um envio só
      envio = (async () => {
        // Um de cada vez, na ordem; para no primeiro que falhar (sem rede).
        for (const pedido of [...cache.ler(userId).pendentes]) {
          const ok = await enviar(pedido);
          if (ok === null) break;
        }
      })().finally(() => {
        envio = null;
      });
      return envio;
    },
  };

  return loja;
}

// ─────────────────────── uma loja por conta (singleton) ─────────────────

const lojas = new Map<string, LojaJornada>();

/**
 * A loja da conta. Todas as telas e todas as montagens (inclusive a dupla do
 * StrictMode) recebem a MESMA loja, então compartilham estado, fila e as
 * chamadas em andamento.
 */
export function lojaDaUsuaria(userId: string): LojaJornada {
  cache.vincularUsuario(userId);
  let loja = lojas.get(userId);
  if (!loja) {
    lojas.clear(); // outra conta: a loja anterior não serve mais
    loja = criarLojaJornada({ userId });
    lojas.set(userId, loja);
  }
  return loja;
}

/** Logout: esquece as lojas e apaga o cache da Jornada (memória e disco). */
export function limparTudo(): void {
  lojas.clear();
  cache.limparTudo();
}
