import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAVE_MOEDA,
  MOEDA_PADRAO,
  assinarMoeda,
  formatMoeda,
  lerMoeda,
  moedaSalva,
  salvarMoeda,
  simboloMoeda,
} from "@/lib/moeda";
import { TEXTOS_MOEDA } from "@/lib/textosMoeda";

const norm = (s: string) => s.replace(/[\s\u00a0\u202f]+/g, " ");

describe("formatMoeda (o formatador único)", () => {
  it("euro: símbolo €, com e sem centavos", () => {
    expect(norm(formatMoeda(1234, "EUR"))).toBe("€ 1.234");
    expect(norm(formatMoeda(1234.5, "EUR", 2))).toBe("€ 1.234,50");
    expect(norm(formatMoeda(0, "EUR"))).toBe("€ 0");
  });

  it("dólar: US$, o mesmo número, só muda o símbolo", () => {
    expect(norm(formatMoeda(1234, "USD"))).toBe("US$ 1.234");
    expect(norm(formatMoeda(1234.5, "USD", 2))).toBe("US$ 1.234,50");
    expect(norm(formatMoeda(100, "USD"))).toBe("US$ 100");
    expect(norm(formatMoeda(100, "EUR"))).toBe("€ 100");
  });

  it('"auto" mostra centavos só quando o valor tem', () => {
    expect(norm(formatMoeda(15, "EUR", "auto"))).toBe("€ 15");
    expect(norm(formatMoeda(12.5, "EUR", "auto"))).toBe("€ 12,50");
    expect(norm(formatMoeda(12.5, "USD", "auto"))).toBe("US$ 12,50");
  });

  it("moeda inválida mostra em euro", () => {
    expect(norm(formatMoeda(10, "BRL" as never))).toBe("€ 10");
  });

  it("símbolo dos rótulos de campo", () => {
    expect(simboloMoeda("EUR")).toBe("€");
    expect(simboloMoeda("USD")).toBe("US$");
  });
});

describe("lerMoeda", () => {
  it("só USD é dólar; qualquer outra coisa vira euro", () => {
    expect(lerMoeda("USD")).toBe("USD");
    expect(lerMoeda("EUR")).toBe("EUR");
    for (const ruim of ["usd", "BRL", "", null, undefined, 3, {}])
      expect(lerMoeda(ruim)).toBe(MOEDA_PADRAO);
    expect(MOEDA_PADRAO).toBe("EUR");
  });
});

describe("seletor de moeda salvo no aparelho", () => {
  let mem: Record<string, string>;
  beforeEach(() => {
    mem = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k in mem ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sem nada salvo, é euro", () => {
    expect(moedaSalva()).toBe("EUR");
  });

  it("salva e lê de volta, nas duas moedas", () => {
    salvarMoeda("USD");
    expect(mem[CHAVE_MOEDA]).toBe("USD");
    expect(moedaSalva()).toBe("USD");
    salvarMoeda("EUR");
    expect(moedaSalva()).toBe("EUR");
  });

  it("a chave é nova (não é jobapp-*)", () => {
    expect(CHAVE_MOEDA.startsWith("jobapp-")).toBe(false);
  });

  it("ignora valor inválido salvo antes", () => {
    mem[CHAVE_MOEDA] = "BRL";
    expect(moedaSalva()).toBe("EUR");
  });

  it("não grava valor inválido: vira euro", () => {
    salvarMoeda("USD");
    salvarMoeda("BRL");
    expect(mem[CHAVE_MOEDA]).toBe("EUR");
  });

  it("avisa as telas quando muda, e para de avisar ao sair", () => {
    const aviso = vi.fn();
    const parar = assinarMoeda(aviso);
    salvarMoeda("USD");
    expect(aviso).toHaveBeenCalledTimes(1);
    parar();
    salvarMoeda("EUR");
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("não troca o valor digitado: só o símbolo muda", () => {
    const digitado = 100;
    salvarMoeda("EUR");
    const eur = norm(formatMoeda(digitado, moedaSalva()));
    salvarMoeda("USD");
    const usd = norm(formatMoeda(digitado, moedaSalva()));
    expect(eur).toBe("€ 100");
    expect(usd).toBe("US$ 100");
  });

  it("sem storage (modo privado), não lança e fica em euro", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(() => salvarMoeda("USD")).not.toThrow();
    expect(moedaSalva()).toBe("EUR");
  });
});

describe("texto do seletor", () => {
  it("avisa em uma frase que os valores digitados não são convertidos", () => {
    expect(TEXTOS_MOEDA.aviso).toMatch(/continuam os mesmos/);
    expect(TEXTOS_MOEDA.aviso.split(/[.!?]/).filter(Boolean)).toHaveLength(1);
  });
});
