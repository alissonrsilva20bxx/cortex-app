import { describe, expect, it, vi } from "vitest";

import {
  atualizarStatusDenuncia,
  isAdmin,
  listarDenuncias,
} from "../../../lib/rede/admin";
import { criarDenuncia } from "../../../lib/rede/denuncias";

function clienteComUsuario(userId = "user-1") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn(),
  };
}

function consultaAdmin(data: { user_id: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

describe("serviço de denúncias e admin", () => {
  it("cria denúncia pendente sem aceitar campos privilegiados", async () => {
    const denuncia = { id: "denuncia-1", status: "pendente" };
    const single = vi.fn().mockResolvedValue({ data: denuncia, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });

    await expect(
      criarDenuncia(client as never, {
        alvoTipo: "post",
        alvoId: "post-1",
        motivo: "spam",
        descricao: "Conteúdo repetido",
      })
    ).resolves.toEqual(denuncia);
    expect(insert).toHaveBeenCalledWith({
      denunciante_id: "user-1",
      alvo_tipo: "post",
      alvo_id: "post-1",
      motivo: "spam",
      descricao: "Conteúdo repetido",
    });
  });

  it("consulta isAdmin pelo userId usando apenas o cliente recebido", async () => {
    const client = clienteComUsuario();
    client.from.mockReturnValue(consultaAdmin({ user_id: "user-1" }));

    await expect(isAdmin(client as never, "user-1")).resolves.toBe(true);
    expect(client.from).toHaveBeenCalledWith("rede_admins");
  });

  it("impede não-admin de usar a listagem administrativa", async () => {
    const client = clienteComUsuario();
    client.from.mockReturnValue(consultaAdmin(null));

    await expect(listarDenuncias(client as never)).rejects.toThrow(
      "Acesso restrito a administradores"
    );
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("lista denúncias para admin em ordem de criação", async () => {
    const denuncias = [{ id: "denuncia-1" }];
    const order = vi.fn().mockResolvedValue({ data: denuncias, error: null });
    const select = vi.fn().mockReturnValue({ order });
    const client = clienteComUsuario();
    client.from
      .mockReturnValueOnce(consultaAdmin({ user_id: "user-1" }))
      .mockReturnValueOnce({ select });

    await expect(listarDenuncias(client as never)).resolves.toEqual(denuncias);
    expect(order).toHaveBeenCalledWith("criado_em", { ascending: false });
  });

  it("registra revisão com identidade viva e snapshot de auditoria", async () => {
    const denuncia = { id: "denuncia-1", status: "revisada" };
    const single = vi.fn().mockResolvedValue({ data: denuncia, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from
      .mockReturnValueOnce(consultaAdmin({ user_id: "user-1" }))
      .mockReturnValueOnce({ update });

    await expect(
      atualizarStatusDenuncia(client as never, {
        denunciaId: "denuncia-1",
        status: "revisada",
      })
    ).resolves.toEqual(denuncia);
    expect(update).toHaveBeenCalledWith({
      status: "revisada",
      revisado_em: expect.any(String),
      revisado_por: "user-1",
      revisado_por_auditoria: "user-1",
    });
  });

  it("registra resolução sem sobrescrever auditoria de revisão", async () => {
    const denuncia = { id: "denuncia-1", status: "resolvida" };
    const single = vi.fn().mockResolvedValue({ data: denuncia, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from
      .mockReturnValueOnce(consultaAdmin({ user_id: "user-1" }))
      .mockReturnValueOnce({ update });

    await expect(
      atualizarStatusDenuncia(client as never, {
        denunciaId: "denuncia-1",
        status: "resolvida",
      })
    ).resolves.toEqual(denuncia);
    expect(update).toHaveBeenCalledWith({
      status: "resolvida",
      resolvido_em: expect.any(String),
      resolvido_por: "user-1",
      resolvido_por_auditoria: "user-1",
    });
  });

  it("não tenta atualizar status quando o usuário não é admin", async () => {
    const client = clienteComUsuario();
    client.from.mockReturnValue(consultaAdmin(null));

    await expect(
      atualizarStatusDenuncia(client as never, {
        denunciaId: "denuncia-1",
        status: "revisada",
      })
    ).rejects.toThrow("Acesso restrito a administradores");
    expect(client.from).toHaveBeenCalledTimes(1);
  });
});
