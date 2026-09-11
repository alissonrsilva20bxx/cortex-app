import { describe, expect, it, vi } from "vitest";

import { verificarAcessoConvite } from "../../../lib/rede/acesso";

type Resposta = {
  data: unknown;
  error: unknown;
  status: number;
};

/** Cliente cujo `.limit(1)` resolve com `respostas.shift()` a cada chamada
 * (pra simular "1ª tenta 401, 2ª pós-refresh dá 200"). `refresh` controla o
 * que `auth.refreshSession()` devolve. */
function cliente(
  respostas: Resposta[],
  refresh: { session: unknown } = { session: null }
) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn(() => Promise.resolve(respostas.shift())),
        }),
      }),
    }),
    auth: {
      refreshSession: vi.fn().mockResolvedValue({ data: refresh, error: null }),
    },
  };
}

function clienteQueRejeita(erro: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(erro),
        }),
      }),
    }),
    auth: { refreshSession: vi.fn() },
  };
}

describe("verificarAcessoConvite", () => {
  it("200 + convite resgatado -> { unlocked: true }", async () => {
    const c = cliente([{ data: [{ id: "cv-1" }], error: null, status: 200 }]);
    await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("200 + zero convites -> { unlocked: false, motivo: 'sem_convite' }", async () => {
    const c = cliente([{ data: [], error: null, status: 200 }]);
    await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
      unlocked: false,
      motivo: "sem_convite",
    });
  });

  it("OFFLINE: postgrest-js resolve com status 0 (não rejeita) -> motivo 'indisponivel'", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = cliente([
      {
        data: null,
        error: { message: "TypeError: fetch failed", code: "" },
        status: 0,
      },
    ]);
    await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
      unlocked: false,
      motivo: "indisponivel",
    });
    spy.mockRestore();
  });

  it("5xx -> motivo 'indisponivel' (não 'sem convite')", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const status of [500, 502, 503]) {
      const c = cliente([
        { data: null, error: { message: "server error" }, status },
      ]);
      await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
        unlocked: false,
        motivo: "indisponivel",
      });
    }
    spy.mockRestore();
  });

  it("403 -> motivo 'negado' (não preserva acesso)", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = cliente([
      { data: null, error: { code: "42501", message: "denied" }, status: 403 },
    ]);
    await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
      unlocked: false,
      motivo: "negado",
    });
    spy.mockRestore();
  });

  it("401 -> tenta refreshSession; recuperou e o retry dá 200 -> { unlocked: true }", async () => {
    const c = cliente(
      [
        {
          data: null,
          error: { code: "PGRST301", message: "JWT" },
          status: 401,
        },
        { data: [{ id: "cv-1" }], error: null, status: 200 },
      ],
      { session: { access_token: "novo" } }
    );
    await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
      unlocked: true,
    });
    expect(c.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("401 -> refreshSession NÃO recuperou a sessão -> motivo 'sessao'", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = cliente(
      [{ data: null, error: { message: "JWT expired" }, status: 401 }],
      { session: null }
    );
    await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
      unlocked: false,
      motivo: "sessao",
    });
    spy.mockRestore();
  });

  it("promise REJEITADA (mock / throw síncrono) -> motivo 'indisponivel'", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = clienteQueRejeita(new TypeError("Failed to fetch"));
    await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
      unlocked: false,
      motivo: "indisponivel",
    });
    spy.mockRestore();
  });
});
