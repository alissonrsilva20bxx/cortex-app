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

  it("resposta que CHEGOU com erro (sessão inválida / RLS / 5xx): fail-closed SEM `erro` -- o gate limpa o cache", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // 401/403/JWT expirado voltam como `error` numa resposta resolvida --
    // NÃO é falha de rede, não pode preservar o cache (req 1).
    for (const err of [
      { code: "PGRST301", message: "JWT expired" },
      { code: "42501", message: "permission denied for table rede_convites" },
      { message: "Internal Server Error", code: "" },
    ]) {
      const client = clienteComResposta({ data: null, error: err });
      await expect(
        verificarAcessoConvite(client as never, "user-1")
      ).resolves.toEqual({ unlocked: false });
    }
    consoleSpy.mockRestore();
  });

  it("o `fetch` REJEITOU (offline / DNS / conexão recusada): `erro: true`, cache preservado (req 4)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = clienteQueRejeita(new TypeError("Failed to fetch"));

    await expect(
      verificarAcessoConvite(client as never, "user-1")
    ).resolves.toEqual({ unlocked: false, erro: true });

    consoleSpy.mockRestore();
  });
});
