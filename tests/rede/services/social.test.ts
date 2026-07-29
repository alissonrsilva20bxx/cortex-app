import { describe, expect, it, vi } from "vitest";

import {
  aceitarPedidoAmizade,
  bloquearUsuario,
  desbloquearUsuario,
  enviarPedidoAmizade,
  recusarPedidoAmizade,
} from "../../../lib/rede/social";

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

describe("serviço social", () => {
  it("envia um pedido pendente em nome do usuário autenticado", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqStatus = vi.fn().mockReturnValue({ maybeSingle });
    const eqDestinatario = vi.fn().mockReturnValue({ eq: eqStatus });
    const eqSolicitante = vi.fn().mockReturnValue({ eq: eqDestinatario });
    const selectExistente = vi.fn().mockReturnValue({ eq: eqSolicitante });
    const pedido = { id: "amizade-1", status: "pendente" };
    const single = vi.fn().mockResolvedValue({ data: pedido, error: null });
    const selectInserido = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInserido });
    const client = clienteComUsuario();
    client.from
      .mockReturnValueOnce({ select: selectExistente })
      .mockReturnValueOnce({ insert });

    await expect(
      enviarPedidoAmizade(client as never, { destinatarioId: "user-2" })
    ).resolves.toEqual(pedido);
    expect(insert).toHaveBeenCalledWith({
      solicitante_id: "user-1",
      destinatario_id: "user-2",
    });
  });

  it("aceita automaticamente um pedido pendente no sentido inverso", async () => {
    const pedidoInverso = {
      id: "amizade-1",
      solicitante_id: "user-2",
      destinatario_id: "user-1",
      status: "pendente",
    };
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: pedidoInverso, error: null });
    const eqStatus = vi.fn().mockReturnValue({ maybeSingle });
    const eqDestinatario = vi.fn().mockReturnValue({ eq: eqStatus });
    const eqSolicitante = vi.fn().mockReturnValue({ eq: eqDestinatario });
    const select = vi.fn().mockReturnValue({ eq: eqSolicitante });
    const aceito = { ...pedidoInverso, status: "aceita" };
    const single = vi.fn().mockResolvedValue({ data: aceito, error: null });
    const selectAtualizado = vi.fn().mockReturnValue({ single });
    const eqId = vi.fn().mockReturnValue({ select: selectAtualizado });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const client = clienteComUsuario();
    client.from.mockReturnValueOnce({ select }).mockReturnValueOnce({ update });

    await expect(
      enviarPedidoAmizade(client as never, { destinatarioId: "user-2" })
    ).resolves.toEqual(aceito);
    expect(update).toHaveBeenCalledWith({
      status: "aceita",
      respondido_em: expect.any(String),
    });
  });

  it("reconsulta e aceita o pedido inverso criado durante uma corrida", async () => {
    const consultaSemPedido = {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const pedidoInverso = {
      id: "amizade-1",
      solicitante_id: "user-2",
      destinatario_id: "user-1",
      status: "pendente",
    };
    const consultaComPedido = {
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: pedidoInverso, error: null }),
    };
    const montarConsulta = (fim: typeof consultaSemPedido) => {
      const eqStatus = vi.fn().mockReturnValue(fim);
      const eqDestinatario = vi.fn().mockReturnValue({ eq: eqStatus });
      const eqSolicitante = vi.fn().mockReturnValue({ eq: eqDestinatario });
      return { select: vi.fn().mockReturnValue({ eq: eqSolicitante }) };
    };
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const aceito = { ...pedidoInverso, status: "aceita" };
    const updateSingle = vi
      .fn()
      .mockResolvedValue({ data: aceito, error: null });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const client = clienteComUsuario();
    client.from
      .mockReturnValueOnce(montarConsulta(consultaSemPedido))
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce(montarConsulta(consultaComPedido))
      .mockReturnValueOnce({ update });

    await expect(
      enviarPedidoAmizade(client as never, { destinatarioId: "user-2" })
    ).resolves.toEqual(aceito);
    expect(client.from).toHaveBeenCalledTimes(4);
    expect(update).toHaveBeenCalledWith({
      status: "aceita",
      respondido_em: expect.any(String),
    });
  });

  it.each([
    ["aceitarPedidoAmizade", aceitarPedidoAmizade, "aceita"],
    ["recusarPedidoAmizade", recusarPedidoAmizade, "recusada"],
  ] as const)("%s responde ao pedido", async (_nome, responder, status) => {
    const amizade = { id: "amizade-1", status };
    const single = vi.fn().mockResolvedValue({ data: amizade, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ update });

    await expect(
      responder(client as never, { amizadeId: "amizade-1" })
    ).resolves.toEqual(amizade);
    expect(update).toHaveBeenCalledWith({
      status,
      respondido_em: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("id", "amizade-1");
  });

  it("bloqueia em nome do usuário autenticado", async () => {
    const bloqueio = {
      id: "bloqueio-1",
      bloqueador_id: "user-1",
      bloqueado_id: "user-2",
    };
    const single = vi.fn().mockResolvedValue({ data: bloqueio, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });

    await expect(
      bloquearUsuario(client as never, { bloqueadoId: "user-2" })
    ).resolves.toEqual(bloqueio);
    expect(insert).toHaveBeenCalledWith({
      bloqueador_id: "user-1",
      bloqueado_id: "user-2",
    });
  });

  it("desbloqueia somente o bloqueio criado pelo usuário autenticado", async () => {
    const eqBloqueado = vi.fn().mockResolvedValue({ error: null });
    const eqBloqueador = vi.fn().mockReturnValue({ eq: eqBloqueado });
    const remove = vi.fn().mockReturnValue({ eq: eqBloqueador });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ delete: remove });

    await expect(
      desbloquearUsuario(client as never, { bloqueadoId: "user-2" })
    ).resolves.toBeUndefined();
    expect(eqBloqueador).toHaveBeenCalledWith("bloqueador_id", "user-1");
    expect(eqBloqueado).toHaveBeenCalledWith("bloqueado_id", "user-2");
  });

  it("recusa escrita sem usuário autenticado", async () => {
    const client = clienteComUsuario();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      bloquearUsuario(client as never, { bloqueadoId: "user-2" })
    ).rejects.toThrow("Usuário não autenticado");
    expect(client.from).not.toHaveBeenCalled();
  });
});
