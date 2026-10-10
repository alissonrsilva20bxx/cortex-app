import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// O transporte de produção (Supabase) não é usado aqui: todos os testes
// passam um transporte falso. O mock só evita criar o cliente real.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import * as cache from "../../lib/jornada/cache";
import {
  criarLojaJornada,
  limparTudo,
  lojaDaUsuaria,
  usarTransporteDeLaboratorio,
} from "../../lib/jornada/cliente";
import { ehEstadoJornada } from "../../lib/jornada/estado";
import type {
  Comemoracao,
  EstadoJornada,
  PedidoRegistro,
  Preferencias,
  RespostaRegistro,
  TransporteJornada,
} from "../../lib/jornada/estado";

/**
 * J11 (#161) — camada cliente da Jornada. Executa a loja de verdade, com um
 * transporte falso no lugar das RPCs da J10 e um armazenamento falso no
 * lugar do `localStorage`.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

/** Tira comentários pra checar só código. */
function soCodigo(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function armazenamentoFalso() {
  const m = new Map<string, string>();
  return {
    mapa: m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

function estado(glowTotal: number): EstadoJornada {
  return {
    glowTotal,
    glowPorPilar: {
      organizar: glowTotal,
      prosperar: 0,
      proteger: 0,
      conectar: 0,
    },
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
        semana: { inicio: "2026-10-05", contadores: { dias_fortes: 2 } },
        mes: { inicio: "2026-10-01", contadores: { dias_fortes: 2 } },
        ano: { inicio: "2026-01-01", contadores: { dias_fortes: 2 } },
      },
      ultimoFechado: {},
    },
  };
}

function comemoracao(
  id: string,
  tipo: Comemoracao["tipo"] = "pequena"
): Comemoracao {
  return { id, tipo, glow: 5, ganhou: true, acao: "despesa" };
}

/**
 * Servidor falso: guarda as chaves já vistas (idempotência, como a J10) e
 * devolve uma comemoração por chave nova. Pode estar "sem rede".
 */
function servidorFalso() {
  let semRede = false;
  let glow = 0;
  const chavesVistas = new Set<string>();
  const registrar = vi.fn(
    async (p: PedidoRegistro): Promise<RespostaRegistro> => {
      await Promise.resolve();
      if (semRede) throw new Error("rede");
      if (chavesVistas.has(p.chave))
        return { estado: estado(glow), comemoracoes: [] };
      chavesVistas.add(p.chave);
      glow += 5;
      return {
        estado: estado(glow),
        comemoracoes: [comemoracao(`c-${p.chave}`)],
      };
    }
  );
  const lerEstado = vi.fn(async () => {
    await Promise.resolve();
    if (semRede) throw new Error("rede");
    return estado(glow);
  });
  let preferencias: Preferencias = {
    somLigado: true,
    modoDiscreto: false,
    mostrarNoPerfil: false,
  };
  const salvarPreferencias = vi.fn(async (parcial: Partial<Preferencias>) => {
    await Promise.resolve();
    if (semRede) throw new Error("rede");
    preferencias = { ...preferencias, ...parcial };
    return preferencias;
  });
  const transporte: TransporteJornada = {
    lerEstado,
    registrar,
    salvarPreferencias,
  };
  return {
    transporte,
    registrar,
    lerEstado,
    salvarPreferencias,
    chavesVistas,
    set semRede(v: boolean) {
      semRede = v;
    },
  };
}

let seq = 0;
const gerarChave = () => `k${++seq}`;
const fuso = () => ({ fuso: "Europe/Lisbon", deslocamentoMin: 60 });

let disco: ReturnType<typeof armazenamentoFalso>;

beforeEach(() => {
  disco = armazenamentoFalso();
  cache._usarArmazenamentoParaTeste(disco);
  cache._resetParaTeste();
  limparTudo();
  seq = 0;
});

function loja(transporte: TransporteJornada, userId = "u1") {
  cache.vincularUsuario(userId);
  return criarLojaJornada({ userId, transporte, gerarChave, fuso });
}

// ---------------------------------------------------------------------------

describe("o cliente não calcula Glow", () => {
  const arquivos = [
    "lib/jornada/cliente.ts",
    "lib/jornada/cache.ts",
    "components/jornada/useJornada.ts",
  ];

  it.each(arquivos)(
    "%s não tem tabela de pontos, limite ou corte de estágio",
    (arquivo) => {
      const codigo = soCodigo(read(arquivo));
      // Nenhum número maior que 1 no código (Glow, limite, corte de estágio, alvo).
      expect(
        codigo.match(/(?<![\w.])(?:[2-9]|\d{2,})(?![\w.])/g) ?? []
      ).toEqual([]);
      // Nenhuma estrutura de pontos ou limite.
      expect(codigo).not.toMatch(
        /\b(pontos|pts|limite|teto|cap|tier|corte)\b/i
      );
      expect(codigo).not.toMatch(/glow\w*\s*[:=+]\s*\d/i);
    }
  );

  it("o Glow mostrado é exatamente o que o servidor mandou", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await l.registrar("despesa");
    expect(l.retrato().estado?.glowTotal).toBe(5);
    expect(l.retrato().fila.map((c) => c.glow)).toEqual([5]);
  });
});

describe("a fila de comemoração sobrevive a fechar e reabrir o app", () => {
  it("o que o servidor mandou fica na fila, na ordem, e reaparece na reabertura", async () => {
    const s = servidorFalso();
    s.registrar.mockImplementationOnce(async (p) => ({
      estado: estado(70),
      comemoracoes: [
        comemoracao(`a-${p.chave}`, "pequena"),
        comemoracao(`b-${p.chave}`, "selo"),
        comemoracao(`c-${p.chave}`, "estagio"),
      ],
    }));
    const l1 = loja(s.transporte);
    await l1.registrar("atendimento");
    expect(l1.retrato().fila.map((c) => c.tipo)).toEqual([
      "pequena",
      "selo",
      "estagio",
    ]);

    cache._fecharAppParaTeste(); // o app fechou: memória perdida, disco fica
    const l2 = loja(s.transporte);
    expect(l2.retrato().fila.map((c) => c.tipo)).toEqual([
      "pequena",
      "selo",
      "estagio",
    ]);
    expect(l2.retrato().estado?.glowTotal).toBe(70);
  });

  it("consumir tira uma de cada vez, e isso também persiste", async () => {
    const s = servidorFalso();
    const l1 = loja(s.transporte);
    await l1.registrar("despesa");
    await l1.registrar("comprovante_cofre");
    const [primeira] = l1.retrato().fila;
    l1.consumir(primeira.id);
    expect(l1.retrato().fila).toHaveLength(1);

    cache._fecharAppParaTeste();
    const l2 = loja(s.transporte);
    expect(l2.retrato().fila).toHaveLength(1);
    expect(l2.retrato().fila[0].id).not.toBe(primeira.id);
  });

  it("a mesma comemoração (mesmo id) nunca entra duas vezes na fila", async () => {
    const s = servidorFalso();
    s.registrar.mockImplementation(async () => ({
      estado: estado(5),
      comemoracoes: [comemoracao("igual")],
    }));
    const l = loja(s.transporte);
    await l.registrar("despesa");
    await l.registrar("despesa");
    expect(l.retrato().fila.map((c) => c.id)).toEqual(["igual"]);
  });
});

describe("montar duas vezes (StrictMode) não registra nem carrega duas vezes", () => {
  it("carregar duas vezes seguidas faz UMA leitura", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await Promise.all([l.carregar(), l.carregar()]);
    expect(s.lerEstado).toHaveBeenCalledTimes(1);
  });

  it("reenviar pendentes duas vezes seguidas manda cada pedido UMA vez", async () => {
    const s = servidorFalso();
    s.semRede = true;
    const l = loja(s.transporte);
    await l.registrar("despesa");
    await l.registrar("planejar");
    expect(l.retrato().pendentes).toBe(2);
    s.registrar.mockClear();
    s.semRede = false;

    await Promise.all([l.enviarPendentes(), l.enviarPendentes()]);
    expect(s.registrar).toHaveBeenCalledTimes(2);
    expect(new Set(s.registrar.mock.calls.map(([p]) => p.chave)).size).toBe(2);
    expect(l.retrato().pendentes).toBe(0);
  });

  it("um registro em andamento não é reenviado ao mesmo tempo pelo reenvio de pendentes", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await Promise.all([l.registrar("despesa"), l.enviarPendentes()]);
    expect(s.registrar).toHaveBeenCalledTimes(1);
  });

  it("abrir a Jornada (selo Primeiros passos) registra UMA vez por abertura do app", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await Promise.all([l.registrarAbertura(), l.registrarAbertura()]);
    await l.registrarAbertura();
    expect(s.registrar).toHaveBeenCalledTimes(1);
    expect(s.registrar.mock.calls[0][0].acao).toBe("abrir_jornada");
  });

  it("toda montagem recebe a mesma loja da conta", () => {
    expect(lojaDaUsuaria("u9")).toBe(lojaDaUsuaria("u9"));
  });

  it("o hook só carrega e reenvia no efeito; registrar nunca acontece num efeito", () => {
    const hook = soCodigo(read("components/jornada/useJornada.ts"));
    const efeito = hook.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[loja\]\);/);
    expect(efeito).not.toBeNull();
    expect(efeito![1]).toContain("loja.carregar()");
    expect(efeito![1]).toContain("loja.enviarPendentes()");
    expect(efeito![1]).not.toMatch(/registrar/);
  });
});

describe("falha de rede não perde a ação", () => {
  it("registrar sem rede não lança, devolve fila vazia e guarda o pedido", async () => {
    const s = servidorFalso();
    s.semRede = true;
    const l = loja(s.transporte);
    await expect(l.registrar("comprovante_cofre")).resolves.toEqual([]);
    expect(l.retrato().pendentes).toBe(1);
    expect(l.retrato().erro).toBe("sem-conexao");
  });

  it("o pedido guardado sobrevive a fechar o app e é entregue depois, com a MESMA chave", async () => {
    const s = servidorFalso();
    s.semRede = true;
    const l1 = loja(s.transporte);
    await l1.registrar("comprovante_cofre");
    const chave = s.registrar.mock.calls[0][0].chave;

    cache._fecharAppParaTeste();
    s.semRede = false;
    s.registrar.mockClear();
    const l2 = loja(s.transporte);
    expect(l2.retrato().pendentes).toBe(1);
    await l2.enviarPendentes();

    expect(s.registrar).toHaveBeenCalledTimes(1);
    expect(s.registrar.mock.calls[0][0].chave).toBe(chave);
    expect(s.registrar.mock.calls[0][0].acao).toBe("comprovante_cofre");
    expect(l2.retrato().pendentes).toBe(0);
    expect(l2.retrato().fila).toHaveLength(1);
    expect(l2.retrato().erro).toBeNull();
  });

  it("o pedido é guardado ANTES de ir pro servidor (app fechado no meio do envio)", async () => {
    const s = servidorFalso();
    let gravadoAntes = false;
    s.registrar.mockImplementationOnce(async () => {
      const raw = disco.getItem("jobapp-jornada:u1");
      gravadoAntes = !!raw && JSON.parse(raw).pendentes.length === 1;
      throw new Error("app fechou");
    });
    const l = loja(s.transporte);
    await l.registrar("despesa");
    expect(gravadoAntes).toBe(true);
  });

  it("falha ao carregar mantém na tela o estado que já estava em cache", async () => {
    const s = servidorFalso();
    const l1 = loja(s.transporte);
    await l1.registrar("despesa");
    cache._fecharAppParaTeste();
    s.semRede = true;
    const l2 = loja(s.transporte);
    await l2.carregar();
    expect(l2.retrato().estado?.glowTotal).toBe(5);
    expect(l2.retrato().erro).toBe("sem-conexao");
    expect(l2.retrato().carregando).toBe(false);
  });

  it("resposta inválida do servidor não substitui o estado", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await l.registrar("despesa");
    s.lerEstado.mockResolvedValueOnce({
      qualquer: 1,
    } as unknown as EstadoJornada);
    await l.carregar();
    expect(l.retrato().estado?.glowTotal).toBe(5);
    expect(l.retrato().erro).toBe("resposta-invalida");
  });
});

describe("contas e privacidade do cache", () => {
  it("o pedido leva só ação, chave e fuso — nenhum id de usuária", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await l.registrar("despesa");
    expect(Object.keys(s.registrar.mock.calls[0][0]).sort()).toEqual(
      ["acao", "chave", "deslocamentoMin", "fuso"].sort()
    );
  });

  it("outra conta não vê o cache da anterior", async () => {
    const s = servidorFalso();
    const l1 = loja(s.transporte, "u1");
    await l1.registrar("despesa");
    cache.vincularUsuario("u2");
    expect(cache.ler("u1").fila).toEqual([]);
    expect(cache.ler("u2").estado).toBeNull();
  });

  it("logout (limparTudo) apaga memória e disco da Jornada", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await l.registrar("despesa");
    expect(disco.length).toBe(1);
    limparTudo();
    expect(disco.length).toBe(0);
  });

  it("o retrato é a mesma referência enquanto nada muda (useSyncExternalStore)", () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    expect(l.retrato()).toBe(l.retrato());
  });
});

describe("preferências (Modo discreto a 1 toque)", () => {
  it("muda na hora, grava no servidor e persiste", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await l.carregar();
    const salvando = l.salvarPreferencias({ modoDiscreto: true });
    // Na hora, antes de o servidor responder.
    expect(l.retrato().estado?.preferencias.modoDiscreto).toBe(true);
    await expect(salvando).resolves.toBe(true);
    expect(s.salvarPreferencias).toHaveBeenCalledWith({ modoDiscreto: true });

    cache._fecharAppParaTeste();
    expect(loja(s.transporte).retrato().estado?.preferencias.modoDiscreto).toBe(
      true
    );
  });

  it("sem rede, volta ao que estava (a chave não mente) e devolve false", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await l.carregar();
    s.semRede = true;
    await expect(l.salvarPreferencias({ modoDiscreto: true })).resolves.toBe(
      false
    );
    expect(l.retrato().estado?.preferencias.modoDiscreto).toBe(false);
    expect(l.retrato().erro).toBe("sem-conexao");
  });

  it("resposta inválida do servidor também volta ao que estava", async () => {
    const s = servidorFalso();
    const l = loja(s.transporte);
    await l.carregar();
    s.salvarPreferencias.mockResolvedValueOnce({
      x: 1,
    } as unknown as Preferencias);
    await expect(l.salvarPreferencias({ somLigado: false })).resolves.toBe(
      false
    );
    expect(l.retrato().estado?.preferencias.somLigado).toBe(true);
  });

  it("o hook expõe salvarPreferencias e nunca grava num efeito", () => {
    const hook = soCodigo(read("components/jornada/useJornada.ts"));
    expect(hook).toContain("salvarPreferencias,");
    const efeito = hook.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[loja\]\);/);
    expect(efeito![1]).not.toMatch(/salvarPreferencias/);
  });
});

describe("transporte de laboratório", () => {
  it("troca o transporte de todas as lojas e esquece as já criadas", async () => {
    const s = servidorFalso();
    const antes = lojaDaUsuaria("lab");
    usarTransporteDeLaboratorio(s.transporte);
    const depois = lojaDaUsuaria("lab");
    expect(depois).not.toBe(antes);
    await depois.carregar();
    expect(s.lerEstado).toHaveBeenCalledTimes(1);
    usarTransporteDeLaboratorio(null);
  });

  it("só o laboratório usa: o app de verdade e o hook não importam isto", () => {
    for (const arquivo of [
      "app/page.tsx",
      "components/jornada/useJornada.ts",
    ]) {
      expect(read(arquivo)).not.toContain("usarTransporteDeLaboratorio");
    }
  });
});

describe("validação dos períodos (J09 jornada_periodos)", () => {
  it("aceita o estado com os 3 períodos", () => {
    expect(ehEstadoJornada(estado(0))).toBe(true);
  });

  it("aceita a forma que o servidor (J10) manda, com último período fechado", () => {
    const e = estado(0);
    expect(
      ehEstadoJornada({
        ...e,
        hoje: "2026-10-06",
        destravados: ["moldura_estagio_1"],
        periodos: {
          ...e.periodos,
          ultimoFechado: {
            semana: { inicio: "2026-09-28", contadores: { glow: 80 } },
          },
        },
      })
    ).toBe(true);
  });

  it("recusa contador que não é número, data fora do formato e período faltando", () => {
    const e = estado(0);
    const corrente = e.periodos.corrente;
    const com = (periodos: unknown) => ({ ...e, periodos });
    expect(
      ehEstadoJornada(
        com({
          ...e.periodos,
          corrente: {
            ...corrente,
            semana: { inicio: "2026-10-05", contadores: { despesa: "4" } },
          },
        })
      )
    ).toBe(false);
    expect(
      ehEstadoJornada(
        com({
          ...e.periodos,
          corrente: {
            ...corrente,
            semana: { inicio: "ontem", contadores: {} },
          },
        })
      )
    ).toBe(false);
    expect(
      ehEstadoJornada(
        com({
          ...e.periodos,
          corrente: { semana: corrente.semana, mes: corrente.mes },
        })
      )
    ).toBe(false);
    expect(ehEstadoJornada({ ...e, periodos: undefined })).toBe(false);
  });

  it("recusa período com campo a mais (nada de diário: decisão 16)", () => {
    const e = estado(0);
    const corrente = e.periodos.corrente;
    const comDias = {
      ...e,
      periodos: {
        ...e.periodos,
        corrente: {
          ...corrente,
          semana: { ...corrente.semana, dias: ["2026-10-05", "2026-10-06"] },
        },
      },
    };
    const fechadoComDias = {
      ...e,
      periodos: {
        ...e.periodos,
        ultimoFechado: {
          semana: { inicio: "2026-09-28", contadores: {}, dias: [] },
        },
      },
    };
    const tipoInventado = {
      ...e,
      periodos: {
        ...e.periodos,
        ultimoFechado: { dia: { inicio: "2026-10-05", contadores: {} } },
      },
    };
    const chaveAMais = {
      ...e,
      periodos: { ...e.periodos, diario: [] },
    };
    expect(ehEstadoJornada(comDias)).toBe(false);
    expect(ehEstadoJornada(fechadoComDias)).toBe(false);
    expect(ehEstadoJornada(tipoInventado)).toBe(false);
    expect(ehEstadoJornada(chaveAMais)).toBe(false);
  });

  it("cache gravado na versão anterior (sem períodos) é descartado", () => {
    disco.setItem(
      "jobapp-jornada:u1",
      JSON.stringify({
        v: 1,
        userId: "u1",
        estado: { glowTotal: 5 },
        fila: [],
        pendentes: [],
      })
    );
    cache._fecharAppParaTeste();
    expect(cache.ler("u1").estado).toBeNull();
  });
});
