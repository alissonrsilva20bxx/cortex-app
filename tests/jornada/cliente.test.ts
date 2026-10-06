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
} from "../../lib/jornada/cliente";
import type {
  Comemoracao,
  EstadoJornada,
  PedidoRegistro,
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
  const transporte: TransporteJornada = { lerEstado, registrar };
  return {
    transporte,
    registrar,
    lerEstado,
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
