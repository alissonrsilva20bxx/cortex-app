import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

/**
 * Botão Descanso da Agenda no DIA SELECIONADO (capitão, 27/10, no iPhone:
 * "não tem como remover o descanso, nem selecionar outro dia para
 * descansar"). Quem escreve -> quem lê: o toque no botão (AgendaAcoes) ->
 * useDescanso -> useJornada -> a loja de verdade -> o servidor (falso, com a
 * regra de uma vez por dia e a chave de idempotência) e o aparelho.
 *
 * O projeto não tem DOM no vitest. Como em tests/pin/pin-sem-https.test.ts,
 * o componente roda de verdade (estado, efeitos, a loja assinada, cliques)
 * com uma versão mínima dos ganchos do React; a árvore devolvida é lida
 * como dados. Não cobre CSS nem o desenho na tela.
 */

const ganchos = vi.hoisted(() => {
  type Limpeza = void | (() => void);
  interface Efeito {
    deps?: readonly unknown[];
    limpar?: Limpeza;
  }
  interface Loja {
    assinada: boolean;
    soltar?: () => void;
  }
  interface Instancia {
    valores: unknown[];
    efeitos: Efeito[];
    refs: { current: unknown }[];
    memos: { deps: readonly unknown[]; valor: unknown }[];
    lojas: Loja[];
    pendentes: { i: number; fn: () => Limpeza }[];
    i: number;
    e: number;
    r: number;
    m: number;
    s: number;
    renderizar: () => void;
    agendar: () => void;
    agendado: boolean;
  }
  let atual: Instancia | null = null;
  const instancia = () => {
    if (!atual) throw new Error("gancho fora do render");
    return atual;
  };
  const mudou = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));

  function useState<T>(inicial: T | (() => T)) {
    const inst = instancia();
    const i = inst.i++;
    if (!(i in inst.valores))
      inst.valores[i] =
        typeof inicial === "function" ? (inicial as () => T)() : inicial;
    const set = (v: T | ((antes: T) => T)) => {
      const antes = inst.valores[i] as T;
      const novo = typeof v === "function" ? (v as (antes: T) => T)(antes) : v;
      if (Object.is(novo, antes)) return;
      inst.valores[i] = novo;
      inst.agendar();
    };
    return [inst.valores[i] as T, set] as const;
  }

  function useEffect(fn: () => Limpeza, deps?: readonly unknown[]) {
    const inst = instancia();
    const i = inst.e++;
    const antes = inst.efeitos[i];
    if (!antes || mudou(antes.deps, deps)) {
      inst.efeitos[i] = { deps, limpar: antes?.limpar };
      inst.pendentes.push({ i, fn });
    }
  }

  function useRef<T>(inicial: T) {
    const inst = instancia();
    const i = inst.r++;
    inst.refs[i] ??= { current: inicial };
    return inst.refs[i] as { current: T };
  }

  function useMemo<T>(fn: () => T, deps: readonly unknown[]): T {
    const inst = instancia();
    const i = inst.m++;
    const antes = inst.memos[i];
    if (!antes || mudou(antes.deps, deps)) {
      inst.memos[i] = { deps, valor: fn() };
    }
    return inst.memos[i].valor as T;
  }

  function useCallback<T>(fn: T, deps: readonly unknown[]): T {
    return useMemo(() => fn, deps);
  }

  function useSyncExternalStore<T>(
    assinar: (ouvinte: () => void) => () => void,
    ler: () => T
  ): T {
    const inst = instancia();
    const i = inst.s++;
    const loja = (inst.lojas[i] ??= { assinada: false });
    if (!loja.assinada) {
      loja.assinada = true;
      loja.soltar = assinar(() => inst.agendar());
    }
    return ler();
  }

  function montar<P>(Componente: (p: P) => ReactNode, inicial: P) {
    let props = inicial;
    let arvore: ReactNode = null;
    const inst: Instancia = {
      valores: [],
      efeitos: [],
      refs: [],
      memos: [],
      lojas: [],
      pendentes: [],
      i: 0,
      e: 0,
      r: 0,
      m: 0,
      s: 0,
      agendado: false,
      agendar() {
        if (inst.agendado) return;
        inst.agendado = true;
        queueMicrotask(() => {
          inst.agendado = false;
          inst.renderizar();
        });
      },
      renderizar() {
        inst.i = inst.e = inst.r = inst.m = inst.s = 0;
        inst.pendentes = [];
        atual = inst;
        try {
          arvore = Componente(props);
        } finally {
          atual = null;
        }
        for (const { i, fn } of inst.pendentes) {
          const limpar = inst.efeitos[i].limpar;
          if (typeof limpar === "function") limpar();
          inst.efeitos[i].limpar = fn();
        }
      },
    };
    inst.renderizar();
    return {
      arvore: () => arvore,
      trocar(novas: Partial<P>) {
        props = { ...props, ...novas };
        inst.renderizar();
      },
      desmontar() {
        for (const e of inst.efeitos)
          if (typeof e?.limpar === "function") e.limpar();
        for (const l of inst.lojas) l.soltar?.();
      },
    };
  }

  return {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
    useSyncExternalStore,
    montar,
  };
});

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: ganchos.useState,
  useEffect: ganchos.useEffect,
  useRef: ganchos.useRef,
  useMemo: ganchos.useMemo,
  useCallback: ganchos.useCallback,
  useSyncExternalStore: ganchos.useSyncExternalStore,
}));
// O transporte de produção (Supabase) não é usado: o servidor aqui é falso.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import * as cache from "@/lib/jornada/cache";
import {
  criarLojaJornada,
  limparTudo,
  usarTransporteDeLaboratorio,
} from "@/lib/jornada/cliente";
import type {
  Acao,
  EstadoJornada,
  MarcaDoDia,
  PedidoRegistro,
  RespostaRegistro,
  TransporteJornada,
} from "@/lib/jornada/estado";
import { diaDoRelogio } from "@/lib/relogio";
import type { Job } from "@/lib/types";
import { useDescanso } from "@/components/jobs/useDescanso";
import { useJornada } from "@/components/jornada/useJornada";
import { AgendaAcoes } from "@/components/jobs/AgendaAcoes";
import { DESCANSO } from "@/components/jobs/textosAgenda";
import {
  bolinhasDaSemana,
  descansoDeHoje,
} from "@/components/jornada/progresso";

// ─────────────────────────── datas de verdade ───────────────────────────

const deslocar = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return diaDoRelogio(d);
};
const HOJE = deslocar(0);
const AMANHA = deslocar(1);
const DEPOIS = deslocar(2);
const ONTEM = deslocar(-1);
const IDX_HOJE = (new Date().getDay() + 6) % 7;

// ─────────────────────────── servidor falso ─────────────────────────────

function disco() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

/**
 * Segue a regra do servidor para o descanso: Glow 10, no máximo um por
 * dia, a mesma chave não conta de novo, marca o dia no ritmo. `com0048`
 * liga a RPC que desfaz (a migration ainda não aplicada); sem ela, o
 * transporte não tem `desfazerDescanso`, como o app antes da 0048.
 */
function servidor({
  com0048 = true,
  descansouHoje = false,
}: { com0048?: boolean; descansouHoje?: boolean } = {}) {
  const s = {
    glow: descansouHoje ? 10 : 0,
    feitas: (descansouHoje ? 1 : 0) as number,
    chaves: new Set<string>(),
    recebidas: [] as string[],
    desfeitos: 0,
  };
  const estado = (): EstadoJornada => {
    const dias: MarcaDoDia[] = [null, null, null, null, null, null, null];
    if (s.feitas) dias[IDX_HOJE] = "descanso";
    return {
      glowTotal: s.glow,
      glowPorPilar: { organizar: 0, prosperar: 0, proteger: s.glow, conectar: 0 },
      estagio: 0,
      glowInicioEstagio: 0,
      glowProximoEstagio: 100,
      selos: {},
      capitulo: null,
      colecao: [],
      marcos: [],
      ajudou: 0,
      protegeu: 0,
      preferencias: { somLigado: true, modoDiscreto: false, mostrarNoPerfil: false },
      periodos: {
        corrente: {
          semana: { inicio: HOJE, contadores: {} },
          mes: { inicio: HOJE, contadores: {} },
          ano: { inicio: HOJE, contadores: {} },
        },
        ultimoFechado: {},
      },
      hoje: HOJE,
      semana: { dias },
      feitasHoje: s.feitas ? { descanso: s.feitas } : {},
    };
  };
  const transporte: TransporteJornada = {
    lerEstado: async () => estado(),
    registrar: async (p: PedidoRegistro): Promise<RespostaRegistro> => {
      s.recebidas.push(`${p.acao}:${p.chave}`);
      if (s.chaves.has(p.chave)) {
        return { estado: estado(), comemoracoes: [], duplicada: true };
      }
      s.chaves.add(p.chave);
      if ((p.acao as Acao) === "descanso" && s.feitas < 1) {
        s.feitas = 1;
        s.glow += 10;
      }
      return { estado: estado(), comemoracoes: [] };
    },
    salvarPreferencias: async (p) => ({
      somLigado: true,
      modoDiscreto: false,
      mostrarNoPerfil: false,
      ...p,
    }),
  };
  if (com0048) {
    transporte.desfazerDescanso = async () => {
      s.desfeitos++;
      if (s.feitas) {
        s.feitas = 0;
        s.glow -= 10;
        s.chaves.clear();
      }
      return estado();
    };
  }
  return { transporte, s };
}

// ─────────────────────────── a tela ─────────────────────────────────────

interface PropsTela {
  userId: string;
  jobs: Job[];
  dia: string;
}

/** O pedaço da Agenda que importa: o hook e a fileira de ações, como no JobsTab. */
function Tela({ userId, jobs, dia }: PropsTela) {
  const descanso = useDescanso(userId, jobs, dia);
  return AgendaAcoes({
    onNovo: () => {},
    onAnotacoes: () => {},
    descanso: { situacao: descanso.situacao, onAlternar: descanso.alternar },
  });
}

/** Quem lê o estado da Jornada pelo hook (card do Início, ritmo da semana). */
function Leitor({ userId }: { userId: string }) {
  return useJornada(userId).estado as unknown as ReactNode;
}

type Elemento = ReactElement<Record<string, unknown>>;

function elementos(no: ReactNode): Elemento[] {
  if (Array.isArray(no)) return no.flatMap(elementos);
  if (!no || typeof no !== "object" || !("props" in no)) return [];
  const el = no as Elemento;
  return [el, ...elementos(el.props.children as ReactNode)];
}

function textoDe(no: ReactNode): string {
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join("");
  if (!no || typeof no !== "object" || !("props" in no)) return "";
  return textoDe((no as Elemento).props.children as ReactNode);
}

const esperar = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

function abrir(props: PropsTela) {
  const tela = ganchos.montar(Tela, props);
  const botao = () => {
    const b = elementos(tela.arvore()).filter((e) => e.type === "button")[1];
    return {
      rotulo: textoDe(b.props.children as ReactNode),
      habilitado: typeof b.props.onClick === "function" && !b.props.disabled,
      pressionado: b.props["aria-pressed"] === true,
      tocar: () => (b.props.onClick as () => void)(),
    };
  };
  const motivo = () =>
    elementos(tela.arvore())
      .filter((e) => e.type === "p" && "data-descanso-motivo" in e.props)
      .map((e) => textoDe(e.props.children as ReactNode))[0] ?? null;
  return { tela, botao, motivo };
}

const job = (data: string): Job =>
  ({ id: `j-${data}`, data, hora: "10:00", status: "agendado" }) as Job;

let telas: { desmontar: () => void }[] = [];
let n = 0;
/** Cada teste com uma conta nova: a loja e o aparelho começam limpos. */
const conta = () => `u-descanso-${++n}`;

beforeEach(() => {
  cache._usarArmazenamentoParaTeste(disco());
  cache._resetParaTeste();
  limparTudo();
});

afterEach(() => {
  telas.forEach((t) => t.desmontar());
  telas = [];
  usarTransporteDeLaboratorio(null);
});

async function agenda(
  srv: ReturnType<typeof servidor>,
  props: Partial<PropsTela> = {}
) {
  usarTransporteDeLaboratorio(srv.transporte);
  const a = abrir({ userId: conta(), jobs: [], dia: HOJE, ...props });
  telas.push(a.tela);
  await esperar();
  return a;
}

// ─────────────────────────── testes ─────────────────────────────────────

describe("Descanso no dia selecionado: marcar e desfazer", () => {
  it("tocar em Descanso marca hoje, conta uma vez na Jornada e o botão vira Descansou", async () => {
    const srv = servidor();
    const { botao, motivo } = await agenda(srv);
    expect(botao().rotulo).toBe(DESCANSO.botao);
    expect(botao().habilitado).toBe(true);

    botao().tocar();
    await esperar();
    expect(botao().rotulo).toBe(DESCANSO.feito);
    expect(botao().pressionado).toBe(true);
    expect(motivo()).toBe(DESCANSO.motivoDesfazer);
    expect(srv.s.recebidas).toEqual([`descanso:descanso-${HOJE}`]);
    expect(srv.s.glow).toBe(10);
  });

  it("tocar em Descansou desfaz: o botão volta e o servidor (com a 0048) tira o Glow do dia", async () => {
    const srv = servidor();
    const { botao, motivo } = await agenda(srv);
    botao().tocar();
    await esperar();
    expect(botao().rotulo).toBe(DESCANSO.feito);

    botao().tocar();
    await esperar();
    expect(botao().rotulo).toBe(DESCANSO.botao);
    expect(botao().habilitado).toBe(true);
    expect(botao().pressionado).toBe(false);
    expect(motivo()).toBeNull();
    expect(srv.s.desfeitos).toBe(1);
    expect(srv.s.glow).toBe(0);

    // Marcar de novo conta de novo, uma vez só.
    botao().tocar();
    await esperar();
    expect(botao().rotulo).toBe(DESCANSO.feito);
    expect(srv.s.glow).toBe(10);
  });

  it("sem a 0048: desfazer fica no aparelho (botão, Próximo passo e ritmo) e marcar de novo não conta duas vezes", async () => {
    const srv = servidor({ com0048: false });
    const userId = conta();
    usarTransporteDeLaboratorio(srv.transporte);
    const a = abrir({ userId, jobs: [], dia: HOJE });
    telas.push(a.tela);
    await esperar();
    a.botao().tocar();
    await esperar();
    a.botao().tocar();
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.botao);
    expect(srv.s.glow).toBe(10); // o servidor sem a 0048 não sabe desfazer

    // Quem lê o estado (card do Início, ritmo) vê o dia sem descanso.
    const leitor = ganchos.montar(Leitor, { userId });
    telas.push(leitor);
    const estado = () => leitor.arvore() as unknown as EstadoJornada;
    expect(descansoDeHoje(estado())).toBe(false);
    expect(bolinhasDaSemana(estado())[IDX_HOJE]).toBe("hoje");

    a.botao().tocar();
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.feito);
    expect(srv.s.glow).toBe(10); // mesma chave do dia: não conta de novo
    expect(descansoDeHoje(estado())).toBe(true);
    expect(bolinhasDaSemana(estado())[IDX_HOJE]).toBe("descanso");
  });
});

describe("Descanso em outro dia", () => {
  it("com hoje já marcado, selecionar amanhã mostra Descanso e marcar funciona (sem ir ao servidor)", async () => {
    const srv = servidor();
    const a = await agenda(srv);
    a.botao().tocar();
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.feito);

    a.tela.trocar({ dia: AMANHA });
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.botao);
    expect(a.botao().habilitado).toBe(true);

    a.botao().tocar();
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.planejado);
    expect(a.botao().pressionado).toBe(true);
    expect(a.motivo()).toBe(DESCANSO.motivoDesfazer);
    expect(srv.s.recebidas).toEqual([`descanso:descanso-${HOJE}`]);

    // Outro dia também: os dois ficam marcados.
    a.tela.trocar({ dia: DEPOIS });
    a.botao().tocar();
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.planejado);
    a.tela.trocar({ dia: HOJE });
    expect(a.botao().rotulo).toBe(DESCANSO.feito);
    a.tela.trocar({ dia: AMANHA });
    expect(a.botao().rotulo).toBe(DESCANSO.planejado);

    // Desfazer amanhã não mexe em hoje nem no servidor.
    a.botao().tocar();
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.botao);
    a.tela.trocar({ dia: HOJE });
    expect(a.botao().rotulo).toBe(DESCANSO.feito);
    expect(srv.s.desfeitos).toBe(0);
    expect(srv.s.glow).toBe(10);
  });

  it("dia com atendimento: não dá pra marcar e a tela diz por quê", async () => {
    const srv = servidor();
    const a = await agenda(srv, { jobs: [job(AMANHA)], dia: AMANHA });
    expect(a.botao().rotulo).toBe(DESCANSO.botao);
    expect(a.botao().habilitado).toBe(false);
    expect(a.motivo()).toBe(DESCANSO.motivoComAtendimento);
    a.tela.trocar({ dia: DEPOIS });
    expect(a.botao().habilitado).toBe(true);
  });

  it("dia que já passou: só leitura", async () => {
    const srv = servidor();
    const a = await agenda(srv, { dia: ONTEM });
    expect(a.botao().habilitado).toBe(false);
    expect(a.motivo()).toBe(DESCANSO.motivoPassou);
  });
});

describe("Descanso: o que já estava salvo", () => {
  it("formato antigo (só o servidor sabia o descanso de hoje): continua Descansou e tocar desfaz", async () => {
    const srv = servidor({ descansouHoje: true });
    const a = await agenda(srv);
    expect(a.botao().rotulo).toBe(DESCANSO.feito);
    expect(a.botao().habilitado).toBe(true);
    a.botao().tocar();
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.botao);
    expect(srv.s.glow).toBe(0);
  });

  it("o que não entende no aparelho é ignorado, sem quebrar a tela", async () => {
    const userId = conta();
    const s = disco();
    s.setItem(
      `jobapp-descansos:${userId}`,
      JSON.stringify({
        v: 1,
        dias: { [AMANHA]: true, [DEPOIS]: "sim", lixo: true, "2026-13": 1 },
      })
    );
    cache._usarArmazenamentoParaTeste(s);
    const srv = servidor();
    usarTransporteDeLaboratorio(srv.transporte);
    const a = abrir({ userId, jobs: [], dia: AMANHA });
    telas.push(a.tela);
    await esperar();
    expect(a.botao().rotulo).toBe(DESCANSO.planejado);
    a.tela.trocar({ dia: DEPOIS });
    expect(a.botao().rotulo).toBe(DESCANSO.botao);

    const quebrado = conta();
    s.setItem(`jobapp-descansos:${quebrado}`, "{nao e json");
    const b = abrir({ userId: quebrado, jobs: [], dia: HOJE });
    telas.push(b.tela);
    await esperar();
    expect(b.botao().rotulo).toBe(DESCANSO.botao);
  });

  it("dia marcado antes conta na Jornada quando chega (uma vez, mesmo carregando de novo)", async () => {
    const srv = servidor();
    let dia = ONTEM;
    const loja = criarLojaJornada({
      userId: conta(),
      transporte: srv.transporte,
      fuso: () => ({ fuso: "UTC", deslocamentoMin: 0 }),
      hoje: () => dia,
    });
    await loja.carregar();
    loja.marcarDescanso(HOJE, true); // "ontem", ela planejou o descanso de hoje
    await esperar();
    expect(srv.s.recebidas).toEqual([]);

    dia = HOJE;
    await loja.carregar();
    await esperar();
    expect(srv.s.recebidas).toEqual([`descanso:descanso-${HOJE}`]);
    expect(srv.s.glow).toBe(10);
    await loja.carregar();
    await esperar();
    expect(srv.s.recebidas).toHaveLength(1);
  });

  it("logout apaga os descansos do aparelho", async () => {
    const s = disco();
    cache._usarArmazenamentoParaTeste(s);
    const loja = criarLojaJornada({
      userId: "u-sai",
      transporte: servidor().transporte,
      hoje: () => HOJE,
    });
    loja.marcarDescanso(AMANHA, true);
    expect(s.getItem("jobapp-descansos:u-sai")).toContain(AMANHA);
    limparTudo();
    expect(s.getItem("jobapp-descansos:u-sai")).toBeNull();
  });
});
