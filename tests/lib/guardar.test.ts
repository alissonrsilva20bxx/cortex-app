import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../lib/database.types";
import {
  guardarNoDesejo,
  listarHistoricoGuardar,
  somarNoDesejo,
} from "../../lib/guardar/guardar";
import { lerValorGuardar } from "../../lib/guardar/valor";

/**
 * Banco em memória que imita o que importa da migration 0044 e da 0021:
 * valor > 0, só o dono grava depósito no próprio Desejo, só o dono lê.
 * `falhar` permite derrubar uma operação para testar a falha parcial.
 * Não é o Postgres real: ver RELATORIO-GUARDAR.md.
 */
function bancoFalso(opts: {
  falhar?: { soma?: boolean; historico?: boolean };
}) {
  const desejos = [
    { id: "d1", user_id: "u1", valor_atual: 10 },
    { id: "d2", user_id: "u2", valor_atual: 0 },
  ];
  const historico: {
    id: string;
    user_id: string;
    desejo_id: string;
    valor: number;
    criado_em: string;
  }[] = [];
  let seq = 0;

  const client = {
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      let ordem = false;
      let limite = Infinity;
      let acao: "select" | "insert" | "update" = "select";
      let payload: Record<string, unknown> = {};
      const q = {
        select() {
          return q;
        },
        insert(p: Record<string, unknown>) {
          acao = "insert";
          payload = p;
          return q;
        },
        update(p: Record<string, unknown>) {
          acao = "update";
          payload = p;
          return q;
        },
        eq(c: string, v: unknown) {
          filtros[c] = v;
          return q;
        },
        order() {
          ordem = true;
          return q;
        },
        limit(n: number) {
          limite = n;
          return q;
        },
        async single() {
          const r = await executar();
          if (r.error) return r;
          const linha = (r.data as unknown[])[0];
          return linha
            ? { data: linha, error: null }
            : { data: null, error: { message: "0 linhas" } };
        },
        then(res: (v: unknown) => unknown) {
          return executar().then(res);
        },
      };
      async function executar(): Promise<{
        data: unknown[] | null;
        error: { message: string } | null;
      }> {
        const casa = (l: Record<string, unknown>) =>
          Object.entries(filtros).every(([c, v]) => l[c] === v);
        if (tabela === "guardar_historico") {
          if (acao === "insert") {
            if (opts.falhar?.historico)
              return { data: null, error: { message: "rede caiu" } };
            const d = desejos.find((x) => x.id === payload.desejo_id);
            if (
              !d ||
              d.user_id !== payload.user_id ||
              Number(payload.valor) <= 0
            )
              return { data: null, error: { message: "RLS/check" } };
            const linha = {
              id: `h${++seq}`,
              user_id: String(payload.user_id),
              desejo_id: String(payload.desejo_id),
              valor: Number(payload.valor),
              criado_em: new Date(2026, 9, 21, 10, seq).toISOString(),
            };
            historico.push(linha);
            return { data: [linha], error: null };
          }
          let r = historico.filter(casa);
          if (ordem) r = [...r].reverse();
          return { data: r.slice(0, limite), error: null };
        }
        if (tabela === "rede_wishlist_items") {
          if (acao === "update") {
            if (opts.falhar?.soma)
              return { data: null, error: { message: "rede caiu" } };
            const r = desejos.filter(casa);
            r.forEach((x) => Object.assign(x, payload));
            return { data: r, error: null };
          }
          return { data: desejos.filter(casa), error: null };
        }
        return { data: null, error: { message: "tabela?" } };
      }
      return q;
    },
  };
  return {
    client: client as unknown as SupabaseClient<Database>,
    desejos,
    historico,
  };
}

describe("lerValorGuardar", () => {
  it.each([
    ["25", 2500],
    ["25,5", 2550],
    ["25.50", 2550],
    ["1.250,00", 125000],
    ["€ 10", 1000],
    ["0,01", 1],
  ])("aceita %s", (texto, centavos) => {
    const r = lerValorGuardar(texto);
    expect(r.ok && r.centavos).toBe(centavos);
  });

  it.each(["", "  ", "abc", "0", "0,00", "-5", "1,234", "12e3", "1,2,3"])(
    "recusa %j",
    (texto) => {
      expect(lerValorGuardar(texto).ok).toBe(false);
    }
  );

  it("recusa valor acima do limite do banco", () => {
    expect(lerValorGuardar("100000000").ok).toBe(false);
    expect(lerValorGuardar("99999999,99").ok).toBe(true);
  });
});

describe("guardarNoDesejo (fluxo: grava -> soma -> tela lê)", () => {
  it("grava o depósito, soma no Desejo e o histórico devolve o que foi escrito", async () => {
    const { client, desejos } = bancoFalso({});
    const r = await guardarNoDesejo(client, {
      userId: "u1",
      desejoId: "d1",
      texto: "25,50",
    });
    expect(r).toEqual({ ok: true, valorAtual: 35.5 });
    expect(desejos[0].valor_atual).toBe(35.5);

    await guardarNoDesejo(client, {
      userId: "u1",
      desejoId: "d1",
      texto: "0,10",
    });
    expect(desejos[0].valor_atual).toBe(35.6);

    const hist = await listarHistoricoGuardar(client, "u1");
    expect(hist.map((h) => h.valor)).toEqual([0.1, 25.5]);
    expect(hist[0].desejoId).toBe("d1");
  });

  it("valor inválido não grava nada", async () => {
    const { client, historico, desejos } = bancoFalso({});
    const r = await guardarNoDesejo(client, {
      userId: "u1",
      desejoId: "d1",
      texto: "-3",
    });
    expect(r.ok).toBe(false);
    expect(historico).toHaveLength(0);
    expect(desejos[0].valor_atual).toBe(10);
  });

  it("sem Desejo escolhido não grava", async () => {
    const { client, historico } = bancoFalso({});
    const r = await guardarNoDesejo(client, {
      userId: "u1",
      desejoId: "",
      texto: "5",
    });
    expect(r).toMatchObject({ ok: false, etapa: "valor" });
    expect(historico).toHaveLength(0);
  });

  it("não grava no Desejo de outra pessoa", async () => {
    const { client, historico, desejos } = bancoFalso({});
    const r = await guardarNoDesejo(client, {
      userId: "u1",
      desejoId: "d2",
      texto: "5",
    });
    expect(r).toMatchObject({ ok: false, etapa: "historico" });
    expect(historico).toHaveLength(0);
    expect(desejos[1].valor_atual).toBe(0);
  });

  it("falha no histórico: nada muda e o erro é claro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, desejos } = bancoFalso({ falhar: { historico: true } });
    const r = await guardarNoDesejo(client, {
      userId: "u1",
      desejoId: "d1",
      texto: "5",
    });
    expect(r).toMatchObject({ ok: false, etapa: "historico" });
    expect(desejos[0].valor_atual).toBe(10);
  });

  it("falha na soma: o depósito fica no histórico e dá para somar de novo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const falha = bancoFalso({ falhar: { soma: true } });
    const r = await guardarNoDesejo(falha.client, {
      userId: "u1",
      desejoId: "d1",
      texto: "5",
    });
    expect(r).toMatchObject({ ok: false, etapa: "soma", centavos: 500 });
    expect(r.ok === false && r.erro).toMatch(/histórico/);
    expect(falha.historico).toHaveLength(1);
    expect(falha.desejos[0].valor_atual).toBe(10);

    // a rede volta: a nova tentativa só soma, sem duplicar o depósito
    const volta = bancoFalso({});
    const s = await somarNoDesejo(volta.client, {
      userId: "u1",
      desejoId: "d1",
      centavos: 500,
    });
    expect(s).toEqual({ ok: true, valorAtual: 15 });
    expect(volta.historico).toHaveLength(0);
  });
});
