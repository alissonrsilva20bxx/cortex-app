import { describe, expect, it, vi } from "vitest";

import {
  alternarCurtida,
  atualizarPost,
  criarComentario,
  criarPost,
  excluirPost,
  listarComentarios,
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
  it("lista os posts mais recentes primeiro, com curtidas/comentários agregados e perfil do autor", async () => {
    const posts = [
      {
        id: "post-1",
        autor_id: "autora-1",
        categoria: "dica",
        texto: "Olá",
        criado_em: "2026-01-01T00:00:00.000Z",
        atualizado_em: "2026-01-01T00:00:00.000Z",
      },
    ];
    const client = clienteComUsuario("user-1");
    client.from.mockImplementation((table: string) => {
      if (table === "rede_posts") {
        const limit = vi.fn().mockResolvedValue({ data: posts, error: null });
        const order = vi.fn().mockReturnValue({ limit });
        return { select: vi.fn().mockReturnValue({ order }) };
      }
      if (table === "rede_curtidas") {
        const inFn = vi.fn().mockResolvedValue({
          data: [{ post_id: "post-1", user_id: "user-1" }],
          error: null,
        });
        return { select: vi.fn().mockReturnValue({ in: inFn }) };
      }
      if (table === "rede_comentarios") {
        const inFn = vi.fn().mockResolvedValue({
          data: [{ post_id: "post-1" }, { post_id: "post-1" }],
          error: null,
        });
        return { select: vi.fn().mockReturnValue({ in: inFn }) };
      }
      if (table === "rede_perfis") {
        const inFn = vi.fn().mockResolvedValue({
          data: [
            {
              user_id: "autora-1",
              nome_exibicao: "Autora",
              cor_avatar: "#fff",
            },
          ],
          error: null,
        });
        return { select: vi.fn().mockReturnValue({ in: inFn }) };
      }
      if (table === "rede_post_fotos") {
        const order = vi.fn().mockResolvedValue({ data: [], error: null });
        const inFn = vi.fn().mockReturnValue({ order });
        return { select: vi.fn().mockReturnValue({ in: inFn }) };
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    await expect(listarFeed(client as never)).resolves.toEqual([
      {
        id: "post-1",
        autorId: "autora-1",
        autorNome: "Autora",
        autorCor: "#fff",
        autorFotoUrl: null,
        categoria: "dica",
        texto: "Olá",
        criadoEm: "2026-01-01T00:00:00.000Z",
        atualizadoEm: "2026-01-01T00:00:00.000Z",
        curtidas: 1,
        curtidoPorMim: true,
        comentariosCount: 2,
        fotos: [],
      },
    ]);
  });

  it("devolve lista vazia sem consultar curtidas/comentários/perfis/fotos quando não há posts", async () => {
    const client = clienteComUsuario("user-1");
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn().mockReturnValue({ limit });
    client.from.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) });

    await expect(listarFeed(client as never)).resolves.toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
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
    ).resolves.toEqual({ post, fotos: [] });
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

  it("atualiza um post só do próprio autor, restringindo por autor_id", async () => {
    const updated = {
      id: "post-1",
      autor_id: "user-1",
      categoria: "duvida",
      texto: "Texto editado",
    };
    const single = vi.fn().mockResolvedValue({ data: updated, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eqAutor = vi.fn().mockReturnValue({ select });
    const eqPost = vi.fn().mockReturnValue({ eq: eqAutor });
    const update = vi.fn().mockReturnValue({ eq: eqPost });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ update });

    await expect(
      atualizarPost(client as never, {
        postId: "post-1",
        categoria: "duvida",
        texto: "Texto editado",
      })
    ).resolves.toEqual(updated);
    expect(update).toHaveBeenCalledWith({
      categoria: "duvida",
      texto: "Texto editado",
    });
    expect(eqPost).toHaveBeenCalledWith("id", "post-1");
    expect(eqAutor).toHaveBeenCalledWith("autor_id", "user-1");
  });

  it("exclui um post só do próprio autor, restringindo por autor_id, e limpa as fotos do Storage", async () => {
    const eqAutor = vi.fn().mockResolvedValue({ error: null });
    const eqPost = vi.fn().mockReturnValue({ eq: eqAutor });
    const remove = vi.fn().mockReturnValue({ eq: eqPost });
    const fotosEqAutor = vi
      .fn()
      .mockResolvedValue({
        data: [{ path: "user-1/posts/post-1/1-x.png" }],
        error: null,
      });
    const fotosEqPost = vi.fn().mockReturnValue({ eq: fotosEqAutor });
    const fotosSelect = vi.fn().mockReturnValue({ eq: fotosEqPost });
    const storageRemove = vi.fn().mockResolvedValue({ error: null });
    const client = clienteComUsuario();
    client.from.mockImplementation((table: string) => {
      if (table === "rede_post_fotos") return { select: fotosSelect };
      if (table === "rede_posts") return { delete: remove };
      throw new Error(`tabela inesperada: ${table}`);
    });
    (client as { storage?: unknown }).storage = {
      from: vi.fn().mockReturnValue({ remove: storageRemove }),
    };

    await expect(
      excluirPost(client as never, { postId: "post-1" })
    ).resolves.toBeUndefined();
    expect(eqPost).toHaveBeenCalledWith("id", "post-1");
    expect(eqAutor).toHaveBeenCalledWith("autor_id", "user-1");
    expect(storageRemove).toHaveBeenCalledWith(["user-1/posts/post-1/1-x.png"]);
  });

  it("lista comentários em ordem cronológica com o perfil de cada autor", async () => {
    const comentarios = [
      {
        id: "com-1",
        post_id: "post-1",
        autor_id: "autora-1",
        texto: "Oi",
        criado_em: "2026-01-01T00:00:00.000Z",
      },
    ];
    const client = clienteComUsuario();
    client.from.mockImplementation((table: string) => {
      if (table === "rede_comentarios") {
        const order = vi
          .fn()
          .mockResolvedValue({ data: comentarios, error: null });
        const eq = vi.fn().mockReturnValue({ order });
        return { select: vi.fn().mockReturnValue({ eq }) };
      }
      if (table === "rede_perfis") {
        const inFn = vi.fn().mockResolvedValue({
          data: [
            {
              user_id: "autora-1",
              nome_exibicao: "Autora",
              cor_avatar: "#fff",
            },
          ],
          error: null,
        });
        return { select: vi.fn().mockReturnValue({ in: inFn }) };
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    await expect(listarComentarios(client as never, "post-1")).resolves.toEqual(
      [
        {
          id: "com-1",
          autorId: "autora-1",
          autorNome: "Autora",
          autorCor: "#fff",
          autorFotoUrl: null,
          texto: "Oi",
          criadoEm: "2026-01-01T00:00:00.000Z",
        },
      ]
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
