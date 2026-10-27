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
import { diaDoRelogio } from "@/lib/relogio";
import * as cache from "./cache";
import {
  apagarDescansos,
  gravarDescanso,
  lerDescansos,
  type Descansos,
} from "./descansos";
import {
  desfazerDescansoNoServidor,
  lerEstadoDoServidor,
  registrarNoServidor,
  salvarPreferenciasNoServidor,
} from "./servidor";
import {
  ehComemoracao,
  ehEstadoJornada,
  ehPreferencias,
  type Acao,
  type Comemoracao,
  type ErroJornada,
  type EstadoJornada,
  type PedidoRegistro,
  type Preferencias,
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
 * As RPCs da J10, pela porta única `servidor.ts` (o único arquivo que sabe
 * os nomes e os parâmetros delas). Mesma forma dos dois lados: os tipos de
 * `estado.ts`. A usuária é sempre a do `auth.uid()` no servidor; nenhum id
 * vai daqui. Preferências: a linha dela em `jornada_preferencias` (RLS:
 * a dona lê, cria e altera a própria).
 */
export const transporteSupabase: TransporteJornada = {
  lerEstado: (fuso, deslocamentoMin) =>
    lerEstadoDoServidor(supabase, fuso, deslocamentoMin),
  registrar: (pedido) => registrarNoServidor(supabase, pedido),
  salvarPreferencias: (parcial) =>
    salvarPreferenciasNoServidor(supabase, parcial),
  desfazerDescanso: (fuso, deslocamentoMin) =>
    desfazerDescansoNoServidor(supabase, fuso, deslocamentoMin),
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
  /** Os dias de descanso marcados no aparelho (`descansos.ts`). As telas
   * leem o estado já com eles (`estadoComDescansos`, no `useJornada`). */
  descansos: Descansos;
}

export interface LojaJornada {
  assinar(ouvinte: () => void): () => void;
  retrato(): RetratoJornada;
  carregar(): Promise<void>;
  /** Virou o dia: busca de novo, mas só uma vez por dia, mesmo que várias
   * telas avisem juntas. */
  carregarNoDia(dia: string): Promise<void>;
  registrar(acao: Acao): Promise<Comemoracao[]>;
  /**
   * Abriu a tela "Sua Jornada" (selo Primeiros passos, §5). Conta UMA vez
   * por abertura do app: a chave é fixa nesta loja, então montar duas vezes
   * (StrictMode) ou chamar de novo não registra de novo -- pode ser chamada
   * num efeito.
   */
  registrarAbertura(): Promise<Comemoracao[]>;
  consumir(id: string): void;
  /** Grava preferências. Muda na tela na hora; se o servidor recusar, volta. */
  salvarPreferencias(parcial: Partial<Preferencias>): Promise<boolean>;
  enviarPendentes(): Promise<void>;
  /**
   * Marca (ou desfaz) o descanso de um dia (botão Descanso da Agenda). Grava
   * no aparelho na hora. Só o de HOJE vai ao servidor, e conta uma vez por
   * dia: marcar manda a ação `descanso` com a chave fixa do dia; desfazer
   * tira o pedido ainda não enviado e chama `desfazerDescanso` (0048).
   * Dia marcado antes que chega a ser hoje conta quando a Jornada carrega.
   */
  marcarDescanso(dia: string, marcado: boolean): void;
}

export interface OpcoesLoja {
  userId: string;
  transporte?: TransporteJornada;
  /** Gera a chave de idempotência (injetável no teste). */
  gerarChave?: () => string;
  /** Fuso (injetável no teste). */
  fuso?: () => { fuso: string; deslocamentoMin: number };
  /** "AAAA-MM-DD" de hoje no aparelho (injetável no teste). */
  hoje?: () => string;
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

/** Chave fixa do descanso de um dia: marcar de novo nunca conta duas vezes. */
function chaveDoDescanso(dia: string): string {
  return `descanso-${dia}`;
}

export function criarLojaJornada(opcoes: OpcoesLoja): LojaJornada {
  const { userId } = opcoes;
  const transporte = opcoes.transporte ?? transporteSupabase;
  const gerarChave = opcoes.gerarChave ?? chaveAleatoria;
  const fuso = opcoes.fuso ?? (() => fusoDaUsuaria());
  const hoje = opcoes.hoje ?? (() => diaDoRelogio(new Date()));

  const ouvintes = new Set<() => void>();
  let carregando = false;
  let erro: ErroJornada | null = null;
  let carregamento: Promise<void> | null = null;
  let diaCarregado: string | null = null;
  let envio: Promise<void> | null = null;
  /** Chaves sendo enviadas agora: o mesmo pedido nunca vai duas vezes ao mesmo tempo. */
  const emVoo = new Set<string>();
  /** Chave da abertura desta sessão; null até a 1ª `registrarAbertura`. */
  let chaveAbertura: string | null = null;
  let descansos = lerDescansos(userId);
  /** Dias cujo descanso de hoje já foi levado ao servidor nesta abertura. */
  const descansoSincronizado = new Set<string>();
  let ultimo: RetratoJornada | null = null;

  function montarRetrato(): RetratoJornada {
    const r = cache.ler(userId);
    if (
      ultimo &&
      ultimo.estado === r.estado &&
      ultimo.descansos === descansos &&
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
      descansos,
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
      if (pedido.acao === "descanso") sincronizarDescanso();
    }
  }

  async function registrarComChave(
    acao: Acao,
    chave: string
  ): Promise<Comemoracao[]> {
    const { fuso: f, deslocamentoMin } = fuso();
    const pedido: PedidoRegistro = { acao, chave, fuso: f, deslocamentoMin };
    // Guarda ANTES de mandar: se o app fechar no meio, o pedido não se perde.
    // A mesma chave já guardada (descanso do dia) não entra de novo.
    cache.atualizar(userId, (r) =>
      r.pendentes.some((p) => p.chave === chave)
        ? r
        : { ...r, pendentes: [...r.pendentes, pedido] }
    );
    avisar();
    const novas = await enviar(pedido);
    return novas ?? [];
  }

  async function desfazerDescansoNoServidor(
    desfazer: NonNullable<TransporteJornada["desfazerDescanso"]>
  ): Promise<void> {
    const ep = cache.epocaAtual();
    const { fuso: f, deslocamentoMin } = fuso();
    try {
      const estado = await desfazer(f, deslocamentoMin);
      if (ehEstadoJornada(estado)) {
        cache.atualizar(userId, (r) => ({ ...r, estado }), ep);
      }
    } catch {
      /* sem a 0048 (ou sem rede): o desfazer fica só no aparelho */
    } finally {
      avisar();
    }
  }

  /**
   * Leva o descanso de HOJE marcado no aparelho ao servidor, uma vez por
   * abertura: marcado e o servidor ainda não conta, registra (chave fixa
   * do dia); desfeito e o servidor ainda conta, pede pra desfazer.
   */
  function sincronizarDescanso(): void {
    const dia = hoje();
    const quer = descansos[dia];
    if (quer === undefined || descansoSincronizado.has(dia)) return;
    const r = cache.ler(userId);
    const noServidor =
      r.estado?.hoje === dia && (r.estado.feitasHoje?.descanso ?? 0) >= 1;
    const chave = chaveDoDescanso(dia);
    if (quer && !noServidor && !r.pendentes.some((p) => p.chave === chave)) {
      descansoSincronizado.add(dia);
      void registrarComChave("descanso", chave);
    } else if (!quer && noServidor && transporte.desfazerDescanso) {
      descansoSincronizado.add(dia);
      void desfazerDescansoNoServidor(transporte.desfazerDescanso);
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
          sincronizarDescanso();
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

    carregarNoDia(dia) {
      if (dia === diaCarregado) return carregamento ?? Promise.resolve();
      diaCarregado = dia;
      return loja.carregar();
    },

    registrar(acao) {
      return registrarComChave(acao, gerarChave());
    },

    registrarAbertura() {
      if (chaveAbertura !== null) return Promise.resolve([]);
      chaveAbertura = gerarChave();
      return registrarComChave("abrir_jornada", chaveAbertura);
    },

    consumir(id) {
      cache.atualizar(userId, (r) => ({
        ...r,
        fila: r.fila.filter((c) => c.id !== id),
      }));
      avisar();
    },

    async salvarPreferencias(parcial) {
      const antes = cache.ler(userId).estado?.preferencias ?? null;
      const trocar = (preferencias: Preferencias | null) =>
        cache.atualizar(userId, (r) =>
          r.estado && preferencias
            ? { ...r, estado: { ...r.estado, preferencias } }
            : r
        );
      // Na hora, pra a chave responder ao toque (o Modo discreto é "1 toque").
      if (antes) trocar({ ...antes, ...parcial });
      avisar();
      const ep = cache.epocaAtual();
      try {
        const salvas = await transporte.salvarPreferencias(parcial);
        if (!ehPreferencias(salvas)) throw new Error("resposta");
        if (cache.epocaAtual() === ep) trocar(salvas);
        erro = null;
        return true;
      } catch {
        // Não gravou: volta ao que estava, pra a tela não mentir.
        if (cache.epocaAtual() === ep) trocar(antes);
        erro = "sem-conexao";
        return false;
      } finally {
        avisar();
      }
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

    marcarDescanso(dia, marcado) {
      descansos = gravarDescanso(userId, dia, marcado, hoje());
      if (!marcado) {
        const chave = chaveDoDescanso(dia);
        cache.atualizar(userId, (r) => ({
          ...r,
          pendentes: r.pendentes.filter((p) => p.chave !== chave),
        }));
      }
      descansoSincronizado.delete(dia);
      avisar();
      sincronizarDescanso();
    },
  };

  return loja;
}

// ─────────────────────── uma loja por conta (singleton) ─────────────────

const lojas = new Map<string, LojaJornada>();

/** Transporte do laboratório (`/dev-preview/app`); `null` = o Supabase real. */
let transporteDoLaboratorio: TransporteJornada | null = null;

/**
 * SÓ pro laboratório (`/dev-preview/app`), que não tem servidor: troca o
 * transporte de todas as lojas por um falso (ver `lib/mockJornada.ts`) e
 * esquece as lojas já criadas. O app de verdade nunca chama isto.
 */
export function usarTransporteDeLaboratorio(
  transporte: TransporteJornada | null
): void {
  transporteDoLaboratorio = transporte;
  lojas.clear();
}

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
    loja = criarLojaJornada({
      userId,
      transporte: transporteDoLaboratorio ?? undefined,
    });
    lojas.set(userId, loja);
  }
  return loja;
}

/** Logout: esquece as lojas e apaga o cache da Jornada (memória e disco). */
export function limparTudo(): void {
  lojas.clear();
  cache.limparTudo();
  apagarDescansos();
}
