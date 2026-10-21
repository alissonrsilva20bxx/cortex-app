import { describe, expect, it } from "vitest";
import {
  desejoPrincipal,
  diasAtePrazo,
  progressoDesejo,
  textoPrazo,
} from "@/lib/desejo/desejo";

const item = (
  id: string,
  valorAlvo: number,
  valorAtual: number,
  criadoEm: string
) => ({ id, valorAlvo, valorAtual, criadoEm });

describe("progressoDesejo", () => {
  it("alvo 0 ou negativo dá 0, sem dividir por zero", () => {
    expect(progressoDesejo(0, 0)).toBe(0);
    expect(progressoDesejo(50, 0)).toBe(0);
    expect(progressoDesejo(50, -10)).toBe(0);
  });

  it("limita em 100 e arredonda para inteiro", () => {
    expect(progressoDesejo(150, 100)).toBe(100);
    expect(progressoDesejo(1, 3)).toBe(33);
    expect(progressoDesejo(2, 3)).toBe(67);
    expect(progressoDesejo(120, 300)).toBe(40);
  });
});

describe("desejoPrincipal", () => {
  it("devolve null sem itens", () => {
    expect(desejoPrincipal([])).toBeNull();
  });

  it("ignora conquistados e alvo 0", () => {
    const itens = [
      item("a", 100, 100, "2026-01-01T00:00:00Z"),
      item("b", 0, 0, "2026-01-02T00:00:00Z"),
      item("c", 200, 50, "2026-01-03T00:00:00Z"),
    ];
    expect(desejoPrincipal(itens)?.id).toBe("c");
  });

  it("pega o mais antigo em aberto, mesmo se vier fora de ordem", () => {
    const itens = [
      item("novo", 100, 0, "2026-03-01T00:00:00Z"),
      item("velho", 100, 10, "2026-01-01T00:00:00Z"),
    ];
    expect(desejoPrincipal(itens)?.id).toBe("velho");
  });

  it("desempata por id quando criadoEm é igual", () => {
    const itens = [
      item("b", 100, 0, "2026-01-01T00:00:00Z"),
      item("a", 100, 0, "2026-01-01T00:00:00Z"),
    ];
    expect(desejoPrincipal(itens)?.id).toBe("a");
  });

  it("devolve null quando todos foram conquistados", () => {
    expect(
      desejoPrincipal([item("a", 100, 100, "2026-01-01T00:00:00Z")])
    ).toBeNull();
  });
});

describe("textoPrazo", () => {
  it("sem prazo devolve null", () => {
    expect(textoPrazo(null)).toBeNull();
    expect(textoPrazo("")).toBeNull();
  });

  it("2026-12-24 não vira dia 23 (fuso)", () => {
    const t = textoPrazo("2026-12-24");
    expect(t).toMatch(/^Até 24 de dez\.? de 2026$/);
  });

  it("data inválida devolve null", () => {
    expect(textoPrazo("24/12/2026")).toBeNull();
  });
});

describe("diasAtePrazo", () => {
  it("conta dias a partir de hoje, negativo se já passou", () => {
    const hoje = new Date(2026, 11, 20, 15, 0);
    expect(diasAtePrazo("2026-12-24", hoje)).toBe(4);
    expect(diasAtePrazo("2026-12-20", hoje)).toBe(0);
    expect(diasAtePrazo("2026-12-19", hoje)).toBe(-1);
    expect(diasAtePrazo(null, hoje)).toBeNull();
  });
});
