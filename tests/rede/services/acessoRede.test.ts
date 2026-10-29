import { describe, expect, it, vi } from "vitest";
import { AuthRetryableFetchError } from "@supabase/supabase-js";

import {
  regraAcessoRede,
  verificarAcessoRede,
} from "../../../lib/rede/acessoRede";
import tabela from "../casos-acesso-rede.json";

type Resposta = { data: unknown; error: unknown; status: number };

const AGORA = new Date(tabela.agora).getTime();

/** Cliente cujas consultas de `configuracoes` e `rede_convites` resolvem
 * com `respostas.shift()` de cada lista (1ª tenta 401, 2ª pós-refresh…). */
function cliente(
  config: Resposta[],
  convite: Resposta[],
  refresh: { data: unknown; error: unknown } = {
    data: { session: null },
    error: null,
  }
) {
  return {
    from: vi.fn((tabelaNome: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() =>
          tabelaNome === "configuracoes"
            ? { maybeSingle: vi.fn(() => Promise.resolve(config.shift())) }
            : { limit: vi.fn(() => Promise.resolve(convite.shift())) }
        ),
      })),
    })),
    auth: { refreshSession: vi.fn().mockResolvedValue(refresh) },
  };
}

const ok = (data: unknown): Resposta => ({ data, error: null, status: 200 });
const emTeste = ok({
  assinatura_status: "trial",
  trial_started_at: "2026-10-17T12:00:00Z",
});
const vencida = ok({
  assinatura_status: "vencida",
  trial_started_at: "2026-09-01T00:00:00Z",
});

describe("regraAcessoRede: a tabela de casos (a mesma do banco, 0049)", () => {
  for (const caso of tabela.casos) {
    it(caso.nome, () => {
      const r = regraAcessoRede(
        {
          assinaturaStatus: caso.assinatura_status,
          trialStartedAt: caso.trial_started_at,
          temConvite: caso.convite,
        },
        AGORA
      );
      expect(r.liberado ? r.por : null).toBe(caso.espera);
    });
  }

  it("liberada pelo teste: diz até quando (início + 7 x 24 h)", () => {
    const r = regraAcessoRede(
      {
        assinaturaStatus: "trial",
        trialStartedAt: "2026-10-17T12:00:00Z",
        temConvite: false,
      },
      AGORA
    );
    expect(r).toEqual({
      liberado: true,
      por: "teste",
      validoAte: new Date("2026-10-24T12:00:00Z").getTime(),
    });
  });

  it("data de início ilegível não abre o teste", () => {
    expect(
      regraAcessoRede(
        { assinaturaStatus: "trial", trialStartedAt: "xx", temConvite: false },
        AGORA
      )
    ).toEqual({ liberado: false });
  });
});

describe("verificarAcessoRede", () => {
  const agora = () => AGORA;

  it("conta nova no teste, sem convite nem código -> entra", async () => {
    const c = cliente([emTeste], [ok([])]);
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      {
        unlocked: true,
        validoAte: new Date("2026-10-24T12:00:00Z").getTime(),
      }
    );
  });

  it("assinatura ativa -> entra, sem prazo", async () => {
    const c = cliente(
      [ok({ assinatura_status: "ativa", trial_started_at: "2026-01-01" })],
      [ok([])]
    );
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      { unlocked: true }
    );
  });

  it("teste acabou e sem assinatura -> 'vencido' (tela de renovação)", async () => {
    const c = cliente([vencida], [ok([])]);
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      { unlocked: false, motivo: "vencido" }
    );
  });

  it("teste acabou, mas já tinha convite usado -> continua entrando (N4)", async () => {
    const c = cliente([vencida], [ok([{ id: "cv-1" }])]);
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      { unlocked: true }
    );
  });

  it("OFFLINE: status 0 (postgrest resolve, não rejeita) -> 'indisponivel'", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const falhou = {
      data: null,
      error: { message: "TypeError: fetch failed" },
      status: 0,
    };
    const c = cliente([falhou], [falhou]);
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      { unlocked: false, motivo: "indisponivel" }
    );
    spy.mockRestore();
  });

  it("5xx numa das consultas -> 'indisponivel', nunca 'vencido'", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const status of [500, 502, 503]) {
      const c = cliente(
        [vencida],
        [{ data: null, error: { message: "x" }, status }]
      );
      await expect(
        verificarAcessoRede(c as never, "u1", agora)
      ).resolves.toEqual({ unlocked: false, motivo: "indisponivel" });
    }
    spy.mockRestore();
  });

  it("403 -> 'negado' (fail-closed), mesmo se a outra consulta caiu", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = cliente(
      [{ data: null, error: { message: "x" }, status: 0 }],
      [{ data: null, error: { code: "42501" }, status: 403 }]
    );
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      { unlocked: false, motivo: "negado" }
    );
    spy.mockRestore();
  });

  it("401 -> refreshSession recuperou e o retry libera", async () => {
    const jwt = { data: null, error: { code: "PGRST301" }, status: 401 };
    const c = cliente([jwt, emTeste], [jwt, ok([])], {
      data: { session: { access_token: "novo" } },
      error: null,
    });
    const r = await verificarAcessoRede(c as never, "u1", agora);
    expect(r.unlocked).toBe(true);
    expect(c.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("401 -> refreshSession não recuperou -> 'sessao'", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const jwt = { data: null, error: { message: "JWT expired" }, status: 401 };
    const c = cliente([jwt], [ok([])]);
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      { unlocked: false, motivo: "sessao" }
    );
    spy.mockRestore();
  });

  it("401 -> o refresh falha por REDE -> 'indisponivel', não 'sessao'", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const jwt = { data: null, error: { message: "JWT expired" }, status: 401 };
    const c = cliente([jwt], [jwt], {
      data: { session: null },
      error: new AuthRetryableFetchError("TypeError: fetch failed", 0),
    });
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      { unlocked: false, motivo: "indisponivel" }
    );
    spy.mockRestore();
  });

  it("promise REJEITADA -> 'indisponivel'", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = {
      from: vi.fn(() => {
        throw new TypeError("Failed to fetch");
      }),
      auth: { refreshSession: vi.fn() },
    };
    await expect(verificarAcessoRede(c as never, "u1", agora)).resolves.toEqual(
      { unlocked: false, motivo: "indisponivel" }
    );
    spy.mockRestore();
  });
});
