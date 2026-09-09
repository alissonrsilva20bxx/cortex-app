import { describe, expect, it, vi } from "vitest";

import { listarBloqueadosComNome } from "../../../lib/rede/bloqueiosGerenciamento";

describe("listarBloqueadosComNome", () => {
  it("maps the RPC rows to PessoaResumo shape", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ user_id: "u1", nome_exibicao: "Fulana", cor_avatar: "#FF0000" }],
      error: null,
    });
    const client = { rpc };

    await expect(listarBloqueadosComNome(client as never)).resolves.toEqual([
      { id: "u1", nome: "Fulana", cor: "#FF0000", bio: "", fotoUrl: null },
    ]);
    expect(rpc).toHaveBeenCalledWith("rede_listar_bloqueados");
  });

  it("returns an empty array when the RPC returns no rows", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc };

    await expect(listarBloqueadosComNome(client as never)).resolves.toEqual([]);
  });

  it("propagates an RPC error instead of swallowing it", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("boom") });
    const client = { rpc };

    await expect(listarBloqueadosComNome(client as never)).rejects.toThrow(
      "boom"
    );
  });
});
