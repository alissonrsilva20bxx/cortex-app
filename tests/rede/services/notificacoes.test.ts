import { describe, expect, it, vi } from "vitest";

import {
  listarNotificacoes,
  marcarNotificacoesVistas,
} from "../../../lib/rede/notificacoes";

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

type TableHandlers = Record<string, unknown>;

function mockFrom(
  client: ReturnType<typeof clienteComUsuario>,
  handlers: TableHandlers
) {
  client.from.mockImplementation((table: string) => {
    if (table in handlers) return handlers[table];
    throw new Error(`tabela inesperada: ${table}`);
  });
}

const PERFIL_SEM_CURSOR = {
  select: () => ({
    eq: () => ({
      maybeSingle: () =>
        Promise.resolve({
          data: { notificacoes_vistas_em: null },
          error: null,
        }),
    }),
  }),
};

function perfisHandler(rows: Record<string, unknown>[]) {
  return {
    select: () => ({
      in: () => Promise.resolve({ data: rows, error: null }),
    }),
  };
}

describe("serviço de notificações", () => {
  it("agrega curtida, comentário, solicitação e mensagem não lida, ordenadas da mais recente pra mais antiga", async () => {
    const client = clienteComUsuario();
    mockFrom(client, {
      rede_perfis: {
        select: (cols: string) => {
          if (cols === "notificacoes_vistas_em") {
            return PERFIL_SEM_CURSOR.select();
          }
          return perfisHandler([
            {
              user_id: "user-2",
              nome_exibicao: "Bia",
              cor_avatar: "#abc",
              bio: null,
            },
            {
              user_id: "user-3",
              nome_exibicao: "Carla",
              cor_avatar: "#def",
              bio: null,
            },
            {
              user_id: "user-4",
              nome_exibicao: "Duda",
              cor_avatar: "#111",
              bio: null,
            },
          ]).select();
        },
      },
      rede_posts: {
        select: () => ({
          eq: () => Promise.resolve({ data: [{ id: "post-1" }], error: null }),
        }),
      },
      rede_conversas_participantes: {
        select: (cols: string) => {
          if (cols === "conversa_id") {
            return {
              eq: () =>
                Promise.resolve({
                  data: [{ conversa_id: "conversa-1" }],
                  error: null,
                }),
            };
          }
          return {
            in: () =>
              Promise.resolve({
                data: [
                  { conversa_id: "conversa-1", user_id: "user-1" },
                  { conversa_id: "conversa-1", user_id: "user-4" },
                ],
                error: null,
              }),
          };
        },
      },
      rede_amizades: {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    id: "amz-1",
                    solicitante_id: "user-3",
                    criado_em: "2026-01-01T00:02:00.000Z",
                  },
                ],
                error: null,
              }),
          }),
        }),
      },
      rede_curtidas: {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [
                {
                  post_id: "post-1",
                  user_id: "user-2",
                  criado_em: "2026-01-01T00:00:00.000Z",
                },
              ],
              error: null,
            }),
        }),
      },
      rede_comentarios: {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [
                {
                  id: "com-1",
                  post_id: "post-1",
                  autor_id: "user-2",
                  texto: "Arrasou!",
                  criado_em: "2026-01-01T00:01:00.000Z",
                },
              ],
              error: null,
            }),
        }),
      },
      rede_mensagens: {
        select: () => ({
          in: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    conversa_id: "conversa-1",
                    autor_id: "user-4",
                    texto: "Oi, tudo bem?",
                    criado_em: "2026-01-01T00:03:00.000Z",
                    lida_em: null,
                  },
                ],
                error: null,
              }),
          }),
        }),
      },
    });

    await expect(listarNotificacoes(client as never)).resolves.toEqual([
      {
        id: "mensagem:conversa-1",
        tipo: "mensagem",
        pessoa: { id: "user-4", nome: "Duda", cor: "#111", bio: "" },
        texto: "Oi, tudo bem?",
        criadoEm: "2026-01-01T00:03:00.000Z",
        lida: false,
        destino: { tipo: "conversa", conversaId: "conversa-1" },
      },
      {
        id: "solicitacao:amz-1",
        tipo: "solicitacao",
        pessoa: { id: "user-3", nome: "Carla", cor: "#def", bio: "" },
        texto: "quer ser sua amiga",
        criadoEm: "2026-01-01T00:02:00.000Z",
        lida: false,
        destino: { tipo: "perfil", userId: "user-3" },
      },
      {
        id: "comentario:com-1",
        tipo: "comentario",
        pessoa: { id: "user-2", nome: "Bia", cor: "#abc", bio: "" },
        texto: 'comentou: "Arrasou!"',
        criadoEm: "2026-01-01T00:01:00.000Z",
        lida: false,
        destino: { tipo: "post", postId: "post-1" },
      },
      {
        id: "curtida:post-1:user-2",
        tipo: "curtida",
        pessoa: { id: "user-2", nome: "Bia", cor: "#abc", bio: "" },
        texto: "curtiu sua publicação",
        criadoEm: "2026-01-01T00:00:00.000Z",
        lida: false,
        destino: { tipo: "post", postId: "post-1" },
      },
    ]);
  });

  it("marca curtida/comentário/solicitação como lida quando criadas antes do cursor, mas nunca mensagem", async () => {
    const client = clienteComUsuario();
    mockFrom(client, {
      rede_perfis: {
        select: (cols: string) => {
          if (cols === "notificacoes_vistas_em") {
            return {
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      notificacoes_vistas_em: "2026-01-01T00:01:30.000Z",
                    },
                    error: null,
                  }),
              }),
            };
          }
          return perfisHandler([
            {
              user_id: "user-2",
              nome_exibicao: "Bia",
              cor_avatar: "#abc",
              bio: null,
            },
            {
              user_id: "user-4",
              nome_exibicao: "Duda",
              cor_avatar: "#111",
              bio: null,
            },
          ]).select();
        },
      },
      rede_posts: {
        select: () => ({
          eq: () => Promise.resolve({ data: [{ id: "post-1" }], error: null }),
        }),
      },
      rede_conversas_participantes: {
        select: (cols: string) => {
          if (cols === "conversa_id") {
            return {
              eq: () =>
                Promise.resolve({
                  data: [{ conversa_id: "conversa-1" }],
                  error: null,
                }),
            };
          }
          return {
            in: () =>
              Promise.resolve({
                data: [
                  { conversa_id: "conversa-1", user_id: "user-1" },
                  { conversa_id: "conversa-1", user_id: "user-4" },
                ],
                error: null,
              }),
          };
        },
      },
      rede_amizades: {
        select: () => ({
          eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        }),
      },
      rede_curtidas: {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [
                {
                  post_id: "post-1",
                  user_id: "user-2",
                  criado_em: "2026-01-01T00:00:00.000Z",
                },
              ],
              error: null,
            }),
        }),
      },
      rede_comentarios: {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [
                {
                  id: "com-1",
                  post_id: "post-1",
                  autor_id: "user-2",
                  texto: "Arrasou!",
                  criado_em: "2026-01-01T00:02:00.000Z",
                },
              ],
              error: null,
            }),
        }),
      },
      rede_mensagens: {
        select: () => ({
          in: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    conversa_id: "conversa-1",
                    autor_id: "user-4",
                    texto: "Oi, tudo bem?",
                    criado_em: "2026-01-01T00:03:00.000Z",
                    lida_em: null,
                  },
                ],
                error: null,
              }),
          }),
        }),
      },
    });

    const result = await listarNotificacoes(client as never);
    const porId = new Map(result.map((n) => [n.id, n]));
    expect(porId.get("curtida:post-1:user-2")?.lida).toBe(true);
    expect(porId.get("comentario:com-1")?.lida).toBe(false);
    expect(porId.get("mensagem:conversa-1")?.lida).toBe(false);
  });

  it("não gera notificação de curtida/comentário quando o próprio dono é o autor", async () => {
    const client = clienteComUsuario();
    mockFrom(client, {
      rede_perfis: {
        select: (cols: string) => {
          if (cols === "notificacoes_vistas_em") {
            return PERFIL_SEM_CURSOR.select();
          }
          return perfisHandler([]).select();
        },
      },
      rede_posts: {
        select: () => ({
          eq: () => Promise.resolve({ data: [{ id: "post-1" }], error: null }),
        }),
      },
      rede_conversas_participantes: {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      },
      rede_amizades: {
        select: () => ({
          eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        }),
      },
      rede_curtidas: {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [
                {
                  post_id: "post-1",
                  user_id: "user-1",
                  criado_em: "2026-01-01T00:00:00.000Z",
                },
              ],
              error: null,
            }),
        }),
      },
      rede_comentarios: {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [
                {
                  id: "com-1",
                  post_id: "post-1",
                  autor_id: "user-1",
                  texto: "comentário próprio",
                  criado_em: "2026-01-01T00:01:00.000Z",
                },
              ],
              error: null,
            }),
        }),
      },
    });

    await expect(listarNotificacoes(client as never)).resolves.toEqual([]);
  });

  it("não consulta curtidas/comentários nem conversas quando a usuária não tem post nem conversa", async () => {
    const client = clienteComUsuario();
    mockFrom(client, {
      rede_perfis: {
        select: (cols: string) => {
          if (cols === "notificacoes_vistas_em") {
            return PERFIL_SEM_CURSOR.select();
          }
          return perfisHandler([]).select();
        },
      },
      rede_posts: {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      },
      rede_conversas_participantes: {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      },
      rede_amizades: {
        select: () => ({
          eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        }),
      },
    });

    await expect(listarNotificacoes(client as never)).resolves.toEqual([]);
    expect(client.from).not.toHaveBeenCalledWith("rede_curtidas");
    expect(client.from).not.toHaveBeenCalledWith("rede_comentarios");
    expect(client.from).not.toHaveBeenCalledWith("rede_mensagens");
  });

  it("avança o cursor de notificações vistas pra usuária autenticada", async () => {
    const client = clienteComUsuario();
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    client.from.mockReturnValue({ update });

    await marcarNotificacoesVistas(client as never);

    expect(update).toHaveBeenCalledWith({
      notificacoes_vistas_em: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("recusa sem usuário autenticado", async () => {
    const client = clienteComUsuario();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(listarNotificacoes(client as never)).rejects.toThrow(
      "Usuário não autenticado"
    );
    await expect(marcarNotificacoesVistas(client as never)).rejects.toThrow(
      "Usuário não autenticado"
    );
    expect(client.from).not.toHaveBeenCalled();
  });
});
