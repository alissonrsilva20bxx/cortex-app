import { describe, expect, it, vi } from "vitest";

import { verificarAcessoConvite } from "../../../lib/rede/acesso";

/** Um cliente cuja `.limit(1)` RESOLVE com a resposta dada (o caminho de
 * longe mais comum: postgrest-js resolve mesmo quando o `fetch` falha). */
function clienteComResposta(resposta: {
  data: unknown;
  error: unknown;
  status: number;
  statusText?: string;
}) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(resposta),
        }),
      }),
    }),
  };
}

/** Um cliente cuja `.limit(1)` REJEITA (raro: mock, throw síncrono). */
function clienteQueRejeita(erro: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(erro),
        }),
      }),
    }),
  };
}

describe("verificarAcessoConvite", () => {
  it("libera acesso quando existe um convite resgatado (200 + linha)", async () => {
    const client = clienteComResposta({
      data: [{ id: "convite-1" }],
      error: null,
      status: 200,
    });

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: true });
  });

  it("CONCLUSIVO 'sem convite': 200 + zero linhas (RLS filtrou) -> gate limpa o cache", async () => {
    const client = clienteComResposta({ data: [], error: null, status: 200 });

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: false });
  });

  it("OFFLINE real: postgrest-js resolve com status 0 (não rejeita) -> indeterminado:transporte", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Resposta sintética que o postgrest-js >=2.x devolve depois de 3
    // retries quando o `fetch` falha (offline / DNS / TLS). Confirmado em
    // runtime -- ver o cabeçalho de lib/rede/acesso.ts.
    const client = clienteComResposta({
      data: null,
      error: { message: "TypeError: fetch failed", code: "" },
      status: 0,
      statusText: "",
    });

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: false, indeterminado: "transporte" });
    consoleSpy.mockRestore();
  });

  it("SERVIDOR fora (5xx) -> indeterminado:servidor, NÃO 'sem convite'", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const status of [500, 502, 503]) {
      const client = clienteComResposta({
        data: null,
        error: { message: "Internal Server Error", code: "" },
        status,
      });
      await expect(
        verificarAcessoConvite(client as never, "user-1")
      ).resolves.toEqual({ unlocked: false, indeterminado: "servidor" });
    }
    consoleSpy.mockRestore();
  });

  it("SESSÃO expirada (401/403, JWT) -> indeterminado:sessao, cache preservado", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const status of [401, 403]) {
      const client = clienteComResposta({
        data: null,
        error: { code: "PGRST301", message: "JWT expired" },
        status,
      });
      await expect(
        verificarAcessoConvite(client as never, "user-1")
      ).resolves.toEqual({ unlocked: false, indeterminado: "sessao" });
    }
    consoleSpy.mockRestore();
  });

  it("4xx que não é sessão (ex.: 400) -> conclusivo fail-closed (sem indeterminado)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = clienteComResposta({
      data: null,
      error: { code: "PGRST100", message: "bad request" },
      status: 400,
    });
    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: false });
    consoleSpy.mockRestore();
  });

  it("promise REJEITADA (mock, throw síncrono) -> indeterminado:transporte (salvaguarda)", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = clienteQueRejeita(new TypeError("Failed to fetch"));

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: false, indeterminado: "transporte" });
    consoleSpy.mockRestore();
  });
});
