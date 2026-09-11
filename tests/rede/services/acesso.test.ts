import { describe, expect, it, vi } from "vitest";
import { AuthRetryableFetchError } from "@supabase/supabase-js";

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

  it("401 -> refreshSession falha por REDE (não por sessão inválida) -> motivo 'indisponivel', não 'sessao'", async () => {
    // Reproduz o formato real que @supabase/auth-js devolve quando o
    // refresh em si esbarra numa falha de rede (reconexão do iOS após 2º
    // plano, DNS/TLS ainda não prontos): `_refreshAccessToken` RESOLVE (não
    // rejeita) com `{ data: { session: null }, error: AuthRetryableFetchError }`
    // depois de esgotar o próprio retry interno do SDK (confirmado lendo
    // node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3896-3933 e
    // lib/fetch.js:121-124 -- todo erro de fetch cru vira
    // `AuthRetryableFetchError`, que É uma `AuthError`, então nunca rejeita
    // aqui). O código atual não distingue isto de uma sessão de fato
    // inválida (refresh_token expirado/revogado) -- ambos caem em
    // `if (error || !data?.session)` e viram "sessao", que no
    // `RedeGatedTab` DERRUBA (zera memória + localStorage). Uma falha de
    // rede durante o refresh não pode ter o mesmo efeito que perder a
    // autorização de verdade.
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "JWT expired" },
              status: 401,
            }),
          }),
        }),
      }),
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: new AuthRetryableFetchError("TypeError: fetch failed", 0),
        }),
      },
    };
    await expect(verificarAcessoConvite(c as never, "u1")).resolves.toEqual({
      unlocked: false,
      motivo: "indisponivel",
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
