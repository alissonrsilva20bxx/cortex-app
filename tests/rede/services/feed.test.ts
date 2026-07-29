import { describe, expect, it, vi } from "vitest";

import {
  alternarCurtida,
  criarComentario,
  criarPost,
  listarFeed,
} from "../../../lib/rede/feed";

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

describe("serviço de feed", () => {
  it("lista os posts mais recentes primeiro", async () => {
    const posts = [{ id: "post-1", texto: "Olá" }];
    const order = vi.fn().mockResolvedValue({ data: posts, error: null });
    const select = vi.fn().mockReturnValue({ order });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    await expect(listarFeed(client as never)).resolves.toEqual(posts);
    expect(client.from).toHaveBeenCalledWith("rede_posts");
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("criado_em", { ascending: false });
  });

  it("cria post de texto em nome do usuário autenticado", async () => {
    const post = {
      id: "post-1",
      autor_id: "user-1",
      categoria: "dica",
      texto: "Uma dica",
    };
    const single = vi.fn().mockResolvedValue({ data: post, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });

    await expect(
      criarPost(client as never, { categoria: "dica", texto: "Uma dica" })
    ).resolves.toEqual(post);
    expect(insert).toHaveBeenCalledWith({
      autor_id: "user-1",
      categoria: "dica",
      texto: "Uma dica",
    });
  });

  it("cria comentário de texto em nome do usuário autenticado", async () => {
    const comentario = {
      id: "comentario-1",
      post_id: "post-1",
      autor_id: "user-1",
      texto: "Concordo",
    };
    const single = vi.fn().mockResolvedValue({ data: comentario, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });

    await expect(
      criarComentario(client as never, {
        postId: "post-1",
        texto: "Concordo",
      })
    ).resolves.toEqual(comentario);
    expect(insert).toHaveBeenCalledWith({
      autor_id: "user-1",
      post_id: "post-1",
      texto: "Concordo",
    });
  });

  it("remove a curtida existente sem criar duplicata", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { post_id: "post-1", user_id: "user-1" },
      error: null,
    });
    const eqUser = vi.fn().mockReturnValue({ maybeSingle });
    const eqPost = vi.fn().mockReturnValue({ eq: eqUser });
    const select = vi.fn().mockReturnValue({ eq: eqPost });
    const deleteEqUser = vi.fn().mockResolvedValue({ error: null });
    const deleteEqPost = vi.fn().mockReturnValue({ eq: deleteEqUser });
    const remove = vi.fn().mockReturnValue({ eq: deleteEqPost });
    const client = clienteComUsuario();
    client.from
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ delete: remove });

    await expect(
      alternarCurtida(client as never, { postId: "post-1" })
    ).resolves.toEqual({ curtido: false });
    expect(remove).toHaveBeenCalledOnce();
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it("cria a curtida ausente usando upsert para impedir duplicatas concorrentes", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqUser = vi.fn().mockReturnValue({ maybeSingle });
    const eqPost = vi.fn().mockReturnValue({ eq: eqUser });
    const select = vi.fn().mockReturnValue({ eq: eqPost });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = clienteComUsuario();
    client.from.mockReturnValueOnce({ select }).mockReturnValueOnce({ upsert });

    await expect(
      alternarCurtida(client as never, { postId: "post-1" })
    ).resolves.toEqual({ curtido: true });
    expect(upsert).toHaveBeenCalledWith(
      { post_id: "post-1", user_id: "user-1" },
      { ignoreDuplicates: true, onConflict: "post_id,user_id" }
    );
  });

  it("recusa escrita quando não há usuário autenticado", async () => {
    const client = clienteComUsuario();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      criarPost(client as never, { categoria: "dica", texto: "Uma dica" })
    ).rejects.toThrow("Usuário não autenticado");
    expect(client.from).not.toHaveBeenCalled();
  });
});
