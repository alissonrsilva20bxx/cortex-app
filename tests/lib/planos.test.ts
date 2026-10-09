import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLANOS,
  PLANO_PADRAO,
  economia,
  formatarEuro,
  guardarPlanoEscolhido,
  menorPrecoPorMes,
  percentualDesconto,
  planoEscolhido,
  planoPorId,
  precoPorMes,
} from "@/lib/planos";

describe("planos do fim do teste (onboarding Linha do tempo)", () => {
  it("são três, em euro: 1 mês 15, 2 meses 25 (cheio 30), 3 meses 30 (cheio 45)", () => {
    expect(PLANOS.map((p) => [p.id, p.meses, p.preco, p.cheio])).toEqual([
      ["1m", 1, 15, null],
      ["2m", 2, 25, 30],
      ["3m", 3, 30, 45],
    ]);
  });

  it("não tem plano Garçom", () => {
    expect(PLANOS.some((p) => /gar[cç]om/i.test(p.nome))).toBe(false);
  });

  it("economiza 5 no de 2 meses e 15 no de 3; nada no de 1", () => {
    expect(economia(planoPorId("1m"))).toBe(0);
    expect(economia(planoPorId("2m"))).toBe(5);
    expect(economia(planoPorId("3m"))).toBe(15);
  });

  it("selo de desconto arredondado: 17% e 33%", () => {
    expect(percentualDesconto(planoPorId("1m"))).toBe(0);
    expect(percentualDesconto(planoPorId("2m"))).toBe(17);
    expect(percentualDesconto(planoPorId("3m"))).toBe(33);
  });

  it("preço por mês e o 'a partir de € 10'", () => {
    expect(precoPorMes(planoPorId("2m"))).toBe(12.5);
    expect(precoPorMes(planoPorId("3m"))).toBe(10);
    expect(menorPrecoPorMes()).toBe(10);
  });

  it("formata como o desenho: '€ 15' e '€ 12,50'", () => {
    expect(formatarEuro(15)).toBe("€ 15");
    expect(formatarEuro(12.5)).toBe("€ 12,50");
  });

  it("nasce marcado o de 3 meses", () => {
    expect(PLANO_PADRAO).toBe("3m");
  });
});

describe("plano escolhido guardado no aparelho", () => {
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

  it("guarda e devolve por usuário", () => {
    guardarPlanoEscolhido("u1", planoPorId("2m"));
    expect(planoEscolhido("u1")).toBe("2m");
    expect(planoEscolhido("u2")).toBeNull();
  });

  it("ignora valor estranho e não lança sem storage", () => {
    mem["jobapp-plano-escolhido:u1"] = "garcom";
    expect(planoEscolhido("u1")).toBeNull();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(() => guardarPlanoEscolhido("u1", planoPorId("1m"))).not.toThrow();
    expect(planoEscolhido("u1")).toBeNull();
  });
});
