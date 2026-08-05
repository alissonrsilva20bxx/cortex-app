import { describe, expect, it, vi } from "vitest";

import { verificarAcessoConvite } from "../../../lib/rede/acesso";

function clienteComResposta(resposta: unknown) {
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
  it("libera acesso quando existe um convite resgatado pelo usuário", async () => {
    const client = clienteComResposta({
      data: [{ id: "convite-1" }],
      error: null,
    });

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: true });
  });

  it("não libera acesso quando não existe convite resgatado", async () => {
    const client = clienteComResposta({ data: [], error: null });

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: false });
  });

  it("falha fechado (sem acesso) e não rejeita quando a consulta retorna erro", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = clienteComResposta({
      data: null,
      error: new Error("falha de rede"),
    });

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: false });

    consoleSpy.mockRestore();
  });

  it("falha fechado (sem acesso) e não rejeita quando o client lança/rejeita (ex.: offline)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = clienteQueRejeita(new TypeError("Failed to fetch"));

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: false });

    consoleSpy.mockRestore();
  });
});
