import { describe, expect, it, vi } from "vitest";

import {
  atualizarPerfil,
  buscarPerfil,
  criarLiveLink,
  criarPerfil,
  excluirLiveLink,
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

  it("reordena os LiveLinks do usuário autenticado pela posição no array", async () => {
    const client = clienteComUsuario();
    const montarAtualizacao = (id: string, ordem: number) => {
      const single = vi
        .fn()
        .mockResolvedValue({ data: { id, ordem }, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const eqUser = vi.fn().mockReturnValue({ select });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const update = vi.fn().mockReturnValue({ eq: eqId });
      return { update, eqId, eqUser };
    };
    const primeira = montarAtualizacao("livelink-2", 0);
    const segunda = montarAtualizacao("livelink-1", 1);
    client.from
      .mockReturnValueOnce({ update: primeira.update })
      .mockReturnValueOnce({ update: segunda.update });

    await expect(
      reordenarLiveLinks(client as never, {
        ids: ["livelink-2", "livelink-1"],
      })
    ).resolves.toEqual([
      { id: "livelink-2", ordem: 0 },
      { id: "livelink-1", ordem: 1 },
    ]);
    expect(primeira.update).toHaveBeenCalledWith({ ordem: 0 });
    expect(primeira.eqId).toHaveBeenCalledWith("id", "livelink-2");
    expect(primeira.eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(segunda.update).toHaveBeenCalledWith({ ordem: 1 });
    expect(segunda.eqId).toHaveBeenCalledWith("id", "livelink-1");
  });

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
