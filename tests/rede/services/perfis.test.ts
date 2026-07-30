import { describe, expect, it, vi } from "vitest";

import {
  atualizarLiveLink,
  atualizarPerfil,
  buscarPerfil,
  buscarPerfisPorIds,
  buscarPessoas,
  criarLiveLink,
  criarPerfil,
  excluirLiveLink,
  LIVELINK_TITULO_MAX_LENGTH,
  LIVELINK_URL_MAX_LENGTH,
  listarLiveLinks,
  reordenarLiveLinks,
} from "../../../lib/rede/perfis";

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

describe("serviço de perfis", () => {
  it("cria o perfil em nome do usuário autenticado", async () => {
    const perfil = {
      user_id: "user-1",
      nome_exibicao: "Ana",
      cor_avatar: "#123456",
      bio: null,
      area_atuacao: null,
    };
    const single = vi.fn().mockResolvedValue({ data: perfil, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });

    await expect(
      criarPerfil(client as never, {
        nomeExibicao: "Ana",
        corAvatar: "#123456",
      })
    ).resolves.toEqual(perfil);
    expect(client.from).toHaveBeenCalledWith("rede_perfis");
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      nome_exibicao: "Ana",
      cor_avatar: "#123456",
      bio: undefined,
      area_atuacao: undefined,
    });
  });

  it("busca o perfil de qualquer membro pelo user_id", async () => {
    const perfil = { user_id: "user-2", nome_exibicao: "Bia" };
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: perfil, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    await expect(buscarPerfil(client as never, "user-2")).resolves.toEqual(
      perfil
    );
    expect(select).toHaveBeenCalledWith("*");
    expect(eq).toHaveBeenCalledWith("user_id", "user-2");
  });

  it("retorna null quando o perfil não existe", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    await expect(
      buscarPerfil(client as never, "user-desconhecido")
    ).resolves.toBeNull();
  });

  it("busca perfis em lote por id, ignorando ids não encontrados", async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: "user-2",
          nome_exibicao: "Bia",
          cor_avatar: "#111",
          bio: null,
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ in: inFn });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    const resultado = await buscarPerfisPorIds(client as never, [
      "user-2",
      "user-3",
    ]);
    expect(resultado.get("user-2")).toEqual({
      id: "user-2",
      nome: "Bia",
      cor: "#111",
      bio: "",
    });
    expect(resultado.has("user-3")).toBe(false);
  });

  it("não consulta o banco quando a lista de ids está vazia", async () => {
    const client = clienteComUsuario();
    const resultado = await buscarPerfisPorIds(client as never, []);
    expect(resultado.size).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("busca pessoas por nome, excluindo a própria conta", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          nome_exibicao: "Eu Mesma",
          cor_avatar: "#000",
          bio: null,
        },
        {
          user_id: "user-2",
          nome_exibicao: "Camila",
          cor_avatar: "#f0f",
          bio: "Oi",
        },
      ],
      error: null,
    });
    const ilike = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ ilike });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    await expect(buscarPessoas(client as never, "cam")).resolves.toEqual([
      { id: "user-2", nome: "Camila", cor: "#f0f", bio: "Oi" },
    ]);
    expect(ilike).toHaveBeenCalledWith("nome_exibicao", "%cam%");
  });

  it("não busca pessoas com termo vazio", async () => {
    const client = clienteComUsuario();
    await expect(buscarPessoas(client as never, "   ")).resolves.toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("atualiza somente o perfil do usuário autenticado", async () => {
    const perfil = { user_id: "user-1", nome_exibicao: "Ana Atualizada" };
    const single = vi.fn().mockResolvedValue({ data: perfil, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ update });

    await expect(
      atualizarPerfil(client as never, { nomeExibicao: "Ana Atualizada" })
    ).resolves.toEqual(perfil);
    expect(update).toHaveBeenCalledWith({
      nome_exibicao: "Ana Atualizada",
      bio: undefined,
      cor_avatar: undefined,
      area_atuacao: undefined,
    });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("cria um LiveLink em nome do usuário autenticado", async () => {
    const livelink = {
      id: "livelink-1",
      user_id: "user-1",
      titulo: "Portfolio",
      url: "https://example.test",
      ordem: 0,
    };
    const single = vi.fn().mockResolvedValue({ data: livelink, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });

    await expect(
      criarLiveLink(client as never, {
        titulo: "Portfolio",
        url: "https://example.test",
        ordem: 0,
      })
    ).resolves.toEqual(livelink);
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      titulo: "Portfolio",
      url: "https://example.test",
      ordem: 0,
    });
  });

  it("normaliza espaços do título e da URL antes de criar um LiveLink", async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });

    await criarLiveLink(client as never, {
      titulo: "  Portfolio  ",
      url: "  https://example.test/portfolio  ",
    });

    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      titulo: "Portfolio",
      url: "https://example.test/portfolio",
      ordem: undefined,
    });
  });

  it.each([
    ["URL relativa", "/portfolio"],
    ["HTTP", "http://example.test"],
    ["protocolo perigoso", "javascript:alert(1)"],
    ["credenciais embutidas", "https://usuario:senha@example.test"],
    ["URL malformada", "não é uma URL"],
  ])("recusa %s ao criar um LiveLink", async (_caso, url) => {
    const client = clienteComUsuario();

    await expect(
      criarLiveLink(client as never, { titulo: "Portfolio", url })
    ).rejects.toThrow("URL do LiveLink");
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([
    ["título vazio", "", "Título do LiveLink"],
    ["título só com espaços", "   ", "Título do LiveLink"],
    ["título acima de 100 caracteres", "a".repeat(101), "Título do LiveLink"],
    [
      "URL acima de 2048 caracteres",
      `https://example.test/${"a".repeat(2028)}`,
      "URL do LiveLink",
    ],
  ])("recusa %s", async (_caso, valor, mensagem) => {
    const client = clienteComUsuario();
    const input =
      _caso === "URL acima de 2048 caracteres"
        ? { titulo: "Portfolio", url: valor }
        : { titulo: valor, url: "https://example.test" };

    await expect(criarLiveLink(client as never, input)).rejects.toThrow(
      mensagem
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it("aceita exatamente os limites técnicos de título e URL", async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });
    const prefix = "https://example.test/";
    const titulo = "a".repeat(LIVELINK_TITULO_MAX_LENGTH);
    const url = prefix + "a".repeat(LIVELINK_URL_MAX_LENGTH - prefix.length);

    await expect(
      criarLiveLink(client as never, { titulo, url })
    ).resolves.toEqual({});
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      titulo,
      url,
      ordem: undefined,
    });
  });

  it("lista os LiveLinks de um usuário ordenados por ordem", async () => {
    const livelinks = [
      { id: "livelink-1", ordem: 0 },
      { id: "livelink-2", ordem: 1 },
    ];
    const order = vi.fn().mockResolvedValue({ data: livelinks, error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    await expect(listarLiveLinks(client as never, "user-1")).resolves.toEqual(
      livelinks
    );
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("ordem", { ascending: true });
  });

  it("reordena todos os LiveLinks em uma única operação atômica", async () => {
    const client = clienteComUsuario();
    const livelinks = [
      { id: "livelink-2", ordem: 0 },
      { id: "livelink-1", ordem: 1 },
    ];
    const rpc = vi.fn().mockResolvedValue({ data: livelinks, error: null });
    Object.assign(client, { rpc });

    await expect(
      reordenarLiveLinks(client as never, {
        ids: ["livelink-2", "livelink-1"],
      })
    ).resolves.toEqual(livelinks);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rede_reordenar_livelinks", {
      livelink_ids: ["livelink-2", "livelink-1"],
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("atualiza título e URL de um LiveLink em nome do usuário autenticado", async () => {
    const livelink = {
      id: "livelink-1",
      user_id: "user-1",
      titulo: "Portfolio novo",
      url: "https://example.test/novo",
      ordem: 0,
    };
    const single = vi.fn().mockResolvedValue({ data: livelink, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eqUser = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ update });

    await expect(
      atualizarLiveLink(client as never, {
        livelinkId: "livelink-1",
        titulo: "Portfolio novo",
        url: "https://example.test/novo",
      })
    ).resolves.toEqual(livelink);
    expect(update).toHaveBeenCalledWith({
      titulo: "Portfolio novo",
      url: "https://example.test/novo",
    });
    expect(eqId).toHaveBeenCalledWith("id", "livelink-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("normaliza espaços do título e da URL antes de atualizar um LiveLink", async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eqUser = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ update });

    await atualizarLiveLink(client as never, {
      livelinkId: "livelink-1",
      titulo: "  Portfolio  ",
      url: "  https://example.test/portfolio  ",
    });

    expect(update).toHaveBeenCalledWith({
      titulo: "Portfolio",
      url: "https://example.test/portfolio",
    });
  });

  it.each([
    ["título vazio", "", "https://example.test", "Título do LiveLink"],
    ["URL relativa", "Portfolio", "/portfolio", "URL do LiveLink"],
  ])(
    "recusa %s ao atualizar um LiveLink",
    async (_caso, titulo, url, mensagem) => {
      const client = clienteComUsuario();

      await expect(
        atualizarLiveLink(client as never, {
          livelinkId: "livelink-1",
          titulo,
          url,
        })
      ).rejects.toThrow(mensagem);
      expect(client.from).not.toHaveBeenCalled();
    }
  );

  it("exclui somente o LiveLink do usuário autenticado", async () => {
    const eqUser = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const remove = vi.fn().mockReturnValue({ eq: eqId });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ delete: remove });

    await expect(
      excluirLiveLink(client as never, { livelinkId: "livelink-1" })
    ).resolves.toBeUndefined();
    expect(eqId).toHaveBeenCalledWith("id", "livelink-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("recusa escrita quando não há usuário autenticado", async () => {
    const client = clienteComUsuario();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      criarPerfil(client as never, {
        nomeExibicao: "Ana",
        corAvatar: "#123456",
      })
    ).rejects.toThrow("Usuário não autenticado");
    expect(client.from).not.toHaveBeenCalled();
  });
});
