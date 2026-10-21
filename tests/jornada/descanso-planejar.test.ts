import { beforeEach, describe, expect, it, vi } from "vitest";

// O transporte de produção (Supabase) não é usado: o servidor aqui é falso.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import * as cache from "../../lib/jornada/cache";
import { criarLojaJornada, limparTudo } from "../../lib/jornada/cliente";
import { descansoDeHoje } from "../../components/jornada/progresso";
import { contaComoPlanejar } from "../../lib/atendimentos/status";
import type {
  Acao,
  EstadoJornada,
  PedidoRegistro,
  RespostaRegistro,
  TransporteJornada,
} from "../../lib/jornada/estado";

/**
 * "Descanso" e "planejar": quem escreve (registrar) -> quem lê
 * (feitasHoje, que o card "Próximo passo" e o botão leem). A loja é a de
 * verdade; o servidor é falso e segue a regra de uma vez por dia.
 */

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

function estado(feitasHoje: Partial<Record<Acao, number>>): EstadoJornada {
  return {
    glowTotal: 0,
    glowPorPilar: { organizar: 0, prosperar: 0, proteger: 0, conectar: 0 },
    estagio: 0,
    glowInicioEstagio: 0,
    glowProximoEstagio: 100,
    selos: {},
    capitulo: null,
    colecao: [],
    marcos: [],
    ajudou: 0,
    protegeu: 0,
    preferencias: {
      somLigado: true,
      modoDiscreto: false,
      mostrarNoPerfil: false,
    },
    periodos: {
      corrente: {
        semana: { inicio: "2026-10-19", contadores: {} },
        mes: { inicio: "2026-10-01", contadores: {} },
        ano: { inicio: "2026-01-01", contadores: {} },
      },
      ultimoFechado: {},
    },
    hoje: "2026-10-21",
    feitasHoje,
  };
}

function servidor() {
  const feitas: Partial<Record<Acao, number>> = {};
  const recebidas: Acao[] = [];
  const transporte: TransporteJornada = {
    lerEstado: async () => estado({ ...feitas }),
    registrar: async (p: PedidoRegistro): Promise<RespostaRegistro> => {
      recebidas.push(p.acao);
      // Limite de 1 por dia, como a regra do servidor.
      feitas[p.acao] = Math.min(1, (feitas[p.acao] ?? 0) + 1);
      return { estado: estado({ ...feitas }), comemoracoes: [] };
    },
    salvarPreferencias: async (p) => ({
      somLigado: true,
      modoDiscreto: false,
      mostrarNoPerfil: false,
      ...p,
    }),
  };
  return { transporte, recebidas };
}

beforeEach(() => {
  cache._usarArmazenamentoParaTeste(disco());
  cache._resetParaTeste();
  limparTudo();
});

describe("Descanso", () => {
  it("registrar descanso chega ao servidor e o botão passa a ver 'já registrado hoje'", async () => {
    const { transporte, recebidas } = servidor();
    let n = 0;
    const loja = criarLojaJornada({
      userId: "u1",
      transporte,
      gerarChave: () => `k${++n}`,
      fuso: () => ({ fuso: "UTC", deslocamentoMin: 0 }),
    });
    await loja.carregar();
    expect(descansoDeHoje(loja.retrato().estado!)).toBe(false);

    await loja.registrar("descanso");
    expect(recebidas).toEqual(["descanso"]);
    expect(descansoDeHoje(loja.retrato().estado!)).toBe(true);
  });

  it("depois de registrado, o 'Próximo passo' não pede descanso de novo", async () => {
    const { proximoPasso } = await import("../../components/jornada/progresso");
    const { transporte } = servidor();
    const loja = criarLojaJornada({
      userId: "u2",
      transporte,
      gerarChave: () => "k",
      fuso: () => ({ fuso: "UTC", deslocamentoMin: 0 }),
    });
    await loja.carregar();
    for (const a of [
      "guardar_meta",
      "comprovante_cofre",
      "planejar",
    ] as const) {
      await loja.registrar(a);
    }
    expect(proximoPasso(loja.retrato().estado!)).toBe("descanso");
    await loja.registrar("descanso");
    expect(proximoPasso(loja.retrato().estado!)).toBe("despesa");
  });
});

describe("planejar ao marcar atendimento para outro dia", () => {
  const HOJE = new Date("2026-10-21T10:00:00");

  it("criar para um dia depois de hoje planeja", () => {
    expect(contaComoPlanejar(false, "2026-10-22", HOJE)).toBe(true);
    expect(contaComoPlanejar(false, "2026-11-15", HOJE)).toBe(true);
  });

  it("criar para hoje ou para o passado não planeja", () => {
    expect(contaComoPlanejar(false, "2026-10-21", HOJE)).toBe(false);
    expect(contaComoPlanejar(false, "2026-10-20", HOJE)).toBe(false);
  });

  it("editar atendimento que já existia não planeja de novo", () => {
    expect(contaComoPlanejar(true, "2026-10-25", HOJE)).toBe(false);
  });

  it("a registrar de planejar chega ao servidor e o passo some do Próximo passo", async () => {
    const { proximoPasso } = await import("../../components/jornada/progresso");
    const { transporte, recebidas } = servidor();
    const loja = criarLojaJornada({
      userId: "u3",
      transporte,
      gerarChave: () => "k",
      fuso: () => ({ fuso: "UTC", deslocamentoMin: 0 }),
    });
    await loja.carregar();
    await loja.registrar("guardar_meta");
    await loja.registrar("comprovante_cofre");
    expect(proximoPasso(loja.retrato().estado!)).toBe("planejar");
    await loja.registrar("planejar");
    expect(recebidas).toContain("planejar");
    expect(proximoPasso(loja.retrato().estado!)).toBe("descanso");
  });
});
