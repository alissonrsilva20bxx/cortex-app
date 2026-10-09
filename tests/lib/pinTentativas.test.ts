import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ESPERA_INICIAL_MS,
  ESPERA_MAXIMA_MS,
  SEM_TENTATIVAS,
  esperaParaErros,
  formatarEspera,
  gravarTentativas,
  lerTentativas,
  registrarErro,
  restanteDaEspera,
  zerarTentativas,
  zerarTodasAsTentativas,
  type EstadoTentativas,
} from "@/lib/pinTentativas";

const MIN = 60_000;

/** Erra `n` vezes seguidas a partir do zero, todas no instante `agora`. */
function errar(n: number, agora = 0): EstadoTentativas {
  let e = SEM_TENTATIVAS;
  for (let i = 0; i < n; i++) e = registrarErro(e, agora);
  return e;
}

describe("limite de tentativas do PIN: 5 erros = 1 min, depois dobra", () => {
  it("os 4 primeiros erros não esperam nada", () => {
    for (let n = 1; n <= 4; n++) {
      expect(esperaParaErros(n)).toBe(0);
      expect(errar(n).esperaAte).toBeNull();
    }
  });

  it("o 5º erro trava por 1 minuto", () => {
    expect(ESPERA_INICIAL_MS).toBe(MIN);
    expect(esperaParaErros(5)).toBe(MIN);
    expect(errar(5, 1000).esperaAte).toBe(1000 + MIN);
  });

  it("errar de novo: 2 minutos; depois 4, 8, 16… (aumenta a cada erro)", () => {
    expect(esperaParaErros(6)).toBe(2 * MIN);
    expect(esperaParaErros(7)).toBe(4 * MIN);
    expect(esperaParaErros(8)).toBe(8 * MIN);
    expect(esperaParaErros(9)).toBe(16 * MIN);
  });

  it("a espera para de crescer em 1 hora", () => {
    expect(ESPERA_MAXIMA_MS).toBe(60 * MIN);
    expect(esperaParaErros(11)).toBe(60 * MIN);
    expect(esperaParaErros(40)).toBe(60 * MIN);
  });

  it("conta os erros seguidos", () => {
    expect(errar(7).erros).toBe(7);
  });

  it("restante da espera: o que falta, e 0 quando acabou", () => {
    const e = errar(5, 0);
    expect(restanteDaEspera(e, 0)).toBe(MIN);
    expect(restanteDaEspera(e, 59_000)).toBe(1000);
    expect(restanteDaEspera(e, MIN)).toBe(0);
    expect(restanteDaEspera(SEM_TENTATIVAS, 123)).toBe(0);
  });

  it("formata a espera em m:ss, arredondando o segundo para cima", () => {
    expect(formatarEspera(MIN)).toBe("1:00");
    expect(formatarEspera(59_001)).toBe("1:00");
    expect(formatarEspera(7_000)).toBe("0:07");
    expect(formatarEspera(16 * MIN)).toBe("16:00");
  });
});

describe("contador guardado no aparelho, por conta", () => {
  let mapa: Map<string, string>;
  beforeEach(() => {
    mapa = new Map();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => mapa.get(k) ?? null,
      setItem: (k: string, v: string) => void mapa.set(k, v),
      removeItem: (k: string) => void mapa.delete(k),
      clear: () => mapa.clear(),
      key: (i: number) => [...mapa.keys()][i] ?? null,
      get length() {
        return mapa.size;
      },
    } as Storage;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("grava e lê de volta (fechar e abrir a tela não zera a espera)", () => {
    const e = errar(5, 500);
    gravarTentativas("u1", e);
    expect(lerTentativas("u1")).toEqual(e);
  });

  it("cada conta tem o seu contador", () => {
    gravarTentativas("u1", errar(5));
    expect(lerTentativas("u2")).toEqual(SEM_TENTATIVAS);
  });

  it("acertar (zerarTentativas) zera só aquela conta", () => {
    gravarTentativas("u1", errar(3));
    gravarTentativas("u2", errar(2));
    zerarTentativas("u1");
    expect(lerTentativas("u1")).toEqual(SEM_TENTATIVAS);
    expect(lerTentativas("u2").erros).toBe(2);
  });

  it("sair da conta (zerarTodasAsTentativas) zera todas e não mexe no resto", () => {
    gravarTentativas("u1", errar(6));
    gravarTentativas("u2", errar(5));
    mapa.set("jobapp-theme", "gold");
    zerarTodasAsTentativas();
    expect(lerTentativas("u1")).toEqual(SEM_TENTATIVAS);
    expect(lerTentativas("u2")).toEqual(SEM_TENTATIVAS);
    expect(mapa.get("jobapp-theme")).toBe("gold");
  });

  it("valor estragado ou forjado no storage vira zero, nunca lança", () => {
    mapa.set("pin:tentativas:u1", "{lixo");
    expect(lerTentativas("u1")).toEqual(SEM_TENTATIVAS);
    mapa.set("pin:tentativas:u1", JSON.stringify({ erros: -3, esperaAte: 1 }));
    expect(lerTentativas("u1")).toEqual(SEM_TENTATIVAS);
  });

  it("sem storage nenhum: lê zero e não lança", () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(lerTentativas("u1")).toEqual(SEM_TENTATIVAS);
    expect(() => gravarTentativas("u1", errar(5))).not.toThrow();
    expect(() => zerarTodasAsTentativas()).not.toThrow();
  });
});
