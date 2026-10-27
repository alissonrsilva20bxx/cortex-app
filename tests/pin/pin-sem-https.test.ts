import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { hashPin, TEXTOS_PIN } from "@/lib/pin";
import { PinScreen } from "@/components/pin/PinScreen";
import { PinSetup } from "@/components/pin/PinSetup";
import type { ReauthAdapter } from "@/lib/reauthRegras";

/**
 * PIN em página não segura (http pelo IP, como o capitão abre o lab no
 * iPhone): o navegador não tem `crypto.subtle`, o hash do PIN rejeita e,
 * sem tratamento, a promessa solta virava o "1 error" do Next e prendia a
 * tela em "Verificando…" (PinScreen) ou com o teclado travado (PinSetup).
 *
 * O projeto não tem DOM no vitest. Aqui o componente roda de verdade
 * (estado, efeitos, promessas, cliques) com uma versão mínima de
 * useState/useEffect/useRef; a árvore devolvida é lida como dados. Não
 * cobre CSS nem o desenho na tela.
 */

const ganchos = vi.hoisted(() => {
  type Limpeza = void | (() => void);
  interface Efeito {
    deps?: readonly unknown[];
    limpar?: Limpeza;
  }
  interface Instancia {
    valores: unknown[];
    efeitos: Efeito[];
    refs: { current: unknown }[];
    pendentes: { i: number; fn: () => Limpeza }[];
    i: number;
    e: number;
    r: number;
    renderizar: () => void;
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
      if (inst.agendado) return;
      inst.agendado = true;
      queueMicrotask(() => {
        inst.agendado = false;
        inst.renderizar();
      });
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

  function montar<P>(Componente: (p: P) => ReactNode, props: P) {
    let arvore: ReactNode = null;
    const inst: Instancia = {
      valores: [],
      efeitos: [],
      refs: [],
      pendentes: [],
      i: 0,
      e: 0,
      r: 0,
      agendado: false,
      renderizar() {
        inst.i = inst.e = inst.r = 0;
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
    return { arvore: () => arvore };
  }

  return { useState, useEffect, useRef, montar };
});

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: ganchos.useState,
  useEffect: ganchos.useEffect,
  useRef: ganchos.useRef,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({ upsert: async () => ({ error: null }) }),
  },
}));
vi.mock("@/components/jornada/useJornada", () => ({
  useJornada: () => ({ registrar: async () => {} }),
}));

type Elemento = ReactElement<Record<string, unknown>>;

function elementos(no: ReactNode): Elemento[] {
  if (Array.isArray(no)) return no.flatMap(elementos);
  if (!no || typeof no !== "object" || !("props" in no)) return [];
  const el = no as Elemento;
  return [el, ...elementos(el.props.children as ReactNode)];
}

function acha(no: ReactNode, teste: (el: Elemento) => boolean): Elemento {
  const el = elementos(no).find(teste);
  if (!el) throw new Error("elemento não encontrado");
  return el;
}

function texto(no: ReactNode): string {
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(texto).join("");
  if (no && typeof no === "object" && "props" in no)
    return texto((no as Elemento).props.children as ReactNode);
  return "";
}

/** Deixa promessas, renders e o aviso de rejeição solta acontecerem. */
const esperar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function armazenamentoFalso() {
  const itens = new Map<string, string>();
  return {
    itens,
    getItem: (k: string) => itens.get(k) ?? null,
    setItem: (k: string, v: string) => void itens.set(k, v),
    removeItem: (k: string) => void itens.delete(k),
    key: (i: number) => [...itens.keys()][i] ?? null,
    get length() {
      return itens.size;
    },
  };
}

const rejeicoes: unknown[] = [];
const ouvirRejeicao = (motivo: unknown) => rejeicoes.push(motivo);
let armazenamento: ReturnType<typeof armazenamentoFalso>;

beforeEach(() => {
  rejeicoes.length = 0;
  process.on("unhandledRejection", ouvirRejeicao);
  armazenamento = armazenamentoFalso();
  vi.stubGlobal("localStorage", armazenamento);
  vi.stubGlobal("window", {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
});

afterEach(() => {
  process.off("unhandledRejection", ouvirRejeicao);
  vi.unstubAllGlobals();
});

/** Página http: o navegador não expõe `crypto.subtle`. */
const semConexaoSegura = () => vi.stubGlobal("crypto", {});

function reauthFalso(): ReauthAdapter {
  return {
    metodos: async () => ["senha"],
    comSenha: async () => ({ ok: true }),
    comGoogle: async () => {},
    motivoPendente: () => null,
    retornoDoGoogle: async () => false,
    gravarPin: vi.fn(async () => true),
  };
}

function abrirTrava(pinHash: string) {
  const onUnlock = vi.fn();
  const reauth = reauthFalso();
  const tela = ganchos.montar(PinScreen, {
    pinHash,
    onUnlock,
    usuarioId: "u1",
    reauth,
  });
  const tocar = (tecla: string) =>
    (
      acha(tela.arvore(), (el) => el.props["data-key"] === tecla).props
        .onClick as () => void
    )();
  const digitar = async (pin: string) => {
    for (const tecla of pin) {
      tocar(tecla);
      await esperar();
    }
    await esperar();
  };
  const mensagem = () =>
    texto(acha(tela.arvore(), (el) => "data-pin-mensagem" in el.props));
  const teclado = () =>
    elementos(tela.arvore()).filter((el) => "data-key" in el.props);
  const casas = () =>
    acha(tela.arvore(), (el) => "data-pin-casas" in el.props).props[
      "aria-label"
    ];
  const titulo = () =>
    texto(acha(tela.arvore(), (el) => el.props.id === "pin-screen-title"));
  return { tela, onUnlock, reauth, digitar, mensagem, teclado, casas, titulo };
}

describe("PinScreen sem conexão segura", () => {
  it("conferir o PIN: sem rejeição solta, teclado livre, aviso de https e nenhum erro contado", async () => {
    const hash = await hashPin("1234");
    semConexaoSegura();
    const t = abrirTrava(hash);

    await t.digitar("1234");

    expect(rejeicoes).toEqual([]);
    expect(t.mensagem()).toBe(TEXTOS_PIN.semConexaoSegura);
    expect(t.casas()).toBe("0 de 4 dígitos preenchidos");
    expect(t.teclado().every((el) => el.props.disabled === false)).toBe(true);
    expect(t.onUnlock).not.toHaveBeenCalled();
    expect(armazenamento.itens.size).toBe(0);
  });

  it("PIN novo do 'Esqueci o PIN': sem rejeição solta, volta ao PIN novo sem gravar nada", async () => {
    semConexaoSegura();
    const t = abrirTrava("qualquer");
    (
      acha(t.tela.arvore(), (el) => "data-pin-esqueci" in el.props).props
        .onClick as () => void
    )();
    await esperar();
    (
      acha(t.tela.arvore(), (el) => el.props.motivo === "esqueci-pin").props
        .onConfirmado as () => void
    )();
    await esperar();

    await t.digitar("5678");
    await t.digitar("5678");

    expect(rejeicoes).toEqual([]);
    expect(t.mensagem()).toBe(TEXTOS_PIN.semConexaoSegura);
    expect(t.titulo()).toBe("Crie um PIN novo");
    expect(t.teclado().every((el) => el.props.disabled === false)).toBe(true);
    expect(t.reauth.gravarPin).not.toHaveBeenCalled();
    expect(t.onUnlock).not.toHaveBeenCalled();
  });

  it("o aviso some no próximo dígito", async () => {
    semConexaoSegura();
    const t = abrirTrava("qualquer");
    await t.digitar("1234");
    await t.digitar("1");
    expect(t.mensagem()).not.toBe(TEXTOS_PIN.semConexaoSegura);
    expect(t.casas()).toBe("1 de 4 dígitos preenchidos");
  });
});

describe("PinScreen com https (comportamento de antes)", () => {
  it("PIN certo libera", async () => {
    const t = abrirTrava(await hashPin("1234"));
    await t.digitar("1234");
    await esperar(250);
    expect(t.onUnlock).toHaveBeenCalledTimes(1);
    expect(rejeicoes).toEqual([]);
  });

  it("PIN errado avisa e conta o erro", async () => {
    const t = abrirTrava(await hashPin("1234"));
    await t.digitar("9999");
    expect(t.mensagem()).toBe("Esse PIN não confere. Tente de novo.");
    expect(armazenamento.itens.get("pin:tentativas:u1")).toContain('"erros":1');
    expect(t.onUnlock).not.toHaveBeenCalled();
  });
});

function abrirCriacao() {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const tela = ganchos.montar(PinSetup, {
    open: true,
    userId: "u1",
    onClose,
    onSaved,
  });
  const folha = () => tela.arvore() as Elemento;
  const teclas = () =>
    elementos(folha().props.children as ReactNode).filter(
      (el) => el.type === "button"
    );
  const digitar = async (pin: string) => {
    for (const tecla of pin) {
      const botao = teclas().find((el) => texto(el) === tecla);
      (botao!.props.onClick as () => void)();
      await esperar();
    }
    await esperar();
  };
  const mensagem = () =>
    texto(acha(folha().props.children as ReactNode, (el) => el.type === "p"));
  return { folha, teclas, digitar, mensagem, onSaved, onClose };
}

describe("PinSetup sem conexão segura", () => {
  it("salvar: sem rejeição solta, teclado livre, aviso de https e nada salvo", async () => {
    semConexaoSegura();
    const t = abrirCriacao();

    await t.digitar("1234");
    await t.digitar("1234");

    expect(rejeicoes).toEqual([]);
    expect(t.mensagem()).toBe(TEXTOS_PIN.semConexaoSegura);
    expect(t.folha().props.title).toBe("Definir PIN");
    expect(t.teclas().every((el) => el.props.disabled === false)).toBe(true);
    expect(t.onSaved).not.toHaveBeenCalled();
  });

  it("o aviso some no próximo dígito", async () => {
    semConexaoSegura();
    const t = abrirCriacao();
    await t.digitar("1234");
    await t.digitar("1234");
    await t.digitar("1");
    expect(t.mensagem()).toBe("Digite um PIN de 4 dígitos");
  });

  it("o aviso some no apagar", async () => {
    semConexaoSegura();
    const t = abrirCriacao();
    await t.digitar("1234");
    await t.digitar("1234");
    const apagar = t.teclas().find((el) => texto(el) === "");
    (apagar!.props.onClick as () => void)();
    await esperar();
    expect(t.mensagem()).toBe("Digite um PIN de 4 dígitos");
  });
});

describe("PinSetup com https (comportamento de antes)", () => {
  it("salva o hash e fecha", async () => {
    const t = abrirCriacao();
    await t.digitar("1234");
    await t.digitar("1234");
    expect(t.onSaved).toHaveBeenCalledWith(await hashPin("1234"));
    expect(t.onClose).toHaveBeenCalled();
    expect(rejeicoes).toEqual([]);
  });

  it("PINs diferentes: o aviso aparece e some no próximo dígito", async () => {
    const t = abrirCriacao();
    await t.digitar("1234");
    await t.digitar("9999");
    expect(t.mensagem()).toBe("PINs não coincidem. Tente novamente.");
    await t.digitar("1");
    expect(t.mensagem()).toBe("Digite um PIN de 4 dígitos");
    expect(t.onSaved).not.toHaveBeenCalled();
  });
});
