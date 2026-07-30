import { describe, expect, it, vi } from "vitest";

import {
  aceitarPedidoAmizade,
  bloquearUsuario,
  desbloquearUsuario,
  enviarPedidoAmizade,
  listarAmigas,
  listarSolicitacoesEnviadas,
  listarSolicitacoesPendentes,
  listarSugestoes,
  recusarPedidoAmizade,
  removerAmizade,
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

  it("lista amigas aceitas nos dois sentidos, excluindo bloqueadas", async () => {
    const client = clienteComUsuario();
    client.from.mockImplementation((table: string) => {
      if (table === "rede_amizades") {
        return {
          select: (cols: string) => ({
            eq: (col1: string) => ({
              eq: () => {
                if (col1 === "solicitante_id") {
                  return Promise.resolve({
                    data: [{ destinatario_id: "user-2" }],
                    error: null,
                  });
                }
                return Promise.resolve({
                  data: [{ solicitante_id: "user-3" }],
                  error: null,
                });
              },
            }),
          }),
        };
      }
      if (table === "rede_bloqueios") {
        return {
          select: () => ({
            eq: (col: string) =>
              col === "bloqueado_id"
                ? Promise.resolve({ data: [], error: null })
                : Promise.resolve({
                    data: [{ bloqueado_id: "user-3" }],
                    error: null,
                  }),
          }),
        };
      }
      if (table === "rede_perfis") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  {
                    user_id: "user-2",
                    nome_exibicao: "Amiga 2",
                    cor_avatar: "#fff",
                    bio: null,
                  },
                ],
                error: null,
              }),
          }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    // user-3 é excluída por bloqueio (aceita mas bloqueada), user-2 fica.
    await expect(listarAmigas(client as never)).resolves.toEqual([
      { id: "user-2", nome: "Amiga 2", cor: "#fff", bio: "" },
    ]);
  });

  it("lista solicitações pendentes recebidas com o perfil de quem enviou", async () => {
    const client = clienteComUsuario();
    client.from.mockImplementation((table: string) => {
      if (table === "rede_amizades") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [{ id: "amizade-1", solicitante_id: "user-2" }],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "rede_bloqueios") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (table === "rede_perfis") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  {
                    user_id: "user-2",
                    nome_exibicao: "Solicitante",
                    cor_avatar: "#abc",
                    bio: "Oi",
                  },
                ],
                error: null,
              }),
          }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    await expect(listarSolicitacoesPendentes(client as never)).resolves.toEqual(
      [
        {
          id: "amizade-1",
          pessoa: { id: "user-2", nome: "Solicitante", cor: "#abc", bio: "Oi" },
        },
      ]
    );
  });

  it("lista os ids das solicitações enviadas e ainda pendentes", async () => {
    const eqStatus = vi.fn().mockResolvedValue({
      data: [{ destinatario_id: "user-2" }, { destinatario_id: "user-3" }],
      error: null,
    });
    const eqSolicitante = vi.fn().mockReturnValue({ eq: eqStatus });
    const select = vi.fn().mockReturnValue({ eq: eqSolicitante });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    await expect(listarSolicitacoesEnviadas(client as never)).resolves.toEqual([
      "user-2",
      "user-3",
    ]);
    expect(eqSolicitante).toHaveBeenCalledWith("solicitante_id", "user-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "pendente");
  });

  it("sugere membros sem relação nem bloqueio em nenhum sentido", async () => {
    const client = clienteComUsuario();
    client.from.mockImplementation((table: string) => {
      if (table === "rede_perfis") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  user_id: "user-1",
                  nome_exibicao: "Eu",
                  cor_avatar: "#000",
                  bio: null,
                },
                {
                  user_id: "user-2",
                  nome_exibicao: "Já amiga",
                  cor_avatar: "#111",
                  bio: null,
                },
                {
                  user_id: "user-3",
                  nome_exibicao: "Bloqueada",
                  cor_avatar: "#222",
                  bio: null,
                },
                {
                  user_id: "user-4",
                  nome_exibicao: "Estranha",
                  cor_avatar: "#333",
                  bio: "Oi",
                },
              ],
              error: null,
            }),
        };
      }
      if (table === "rede_amizades") {
        return {
          select: (cols: string) => ({
            eq: () =>
              cols === "destinatario_id"
                ? Promise.resolve({
                    data: [{ destinatario_id: "user-2" }],
                    error: null,
                  })
                : Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (table === "rede_bloqueios") {
        return {
          select: () => ({
            eq: (col: string) =>
              col === "bloqueado_id"
                ? Promise.resolve({ data: [], error: null })
                : Promise.resolve({
                    data: [{ bloqueado_id: "user-3" }],
                    error: null,
                  }),
          }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    await expect(listarSugestoes(client as never)).resolves.toEqual([
      { id: "user-4", nome: "Estranha", cor: "#333", bio: "Oi" },
    ]);
  });

  it("remove a amizade em qualquer sentido entre os dois usuários", async () => {
    const eqB1 = vi.fn().mockResolvedValue({ error: null });
    const eqA1 = vi.fn().mockReturnValue({ eq: eqB1 });
    const eqB2 = vi.fn().mockResolvedValue({ error: null });
    const eqA2 = vi.fn().mockReturnValue({ eq: eqB2 });
    const remove1 = vi.fn().mockReturnValue({ eq: eqA1 });
    const remove2 = vi.fn().mockReturnValue({ eq: eqA2 });
    const client = clienteComUsuario();
    client.from
      .mockReturnValueOnce({ delete: remove1 })
      .mockReturnValueOnce({ delete: remove2 });

    await expect(
      removerAmizade(client as never, { outroUserId: "user-2" })
    ).resolves.toBeUndefined();
    expect(eqA1).toHaveBeenCalledWith("solicitante_id", "user-1");
    expect(eqB1).toHaveBeenCalledWith("destinatario_id", "user-2");
    expect(eqA2).toHaveBeenCalledWith("solicitante_id", "user-2");
    expect(eqB2).toHaveBeenCalledWith("destinatario_id", "user-1");
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
