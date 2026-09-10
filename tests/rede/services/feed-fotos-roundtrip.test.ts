import { describe, expect, it } from "vitest";

import {
  criarPost,
  dimensoesDaMiniatura,
  excluirPost,
  listarFeed,
} from "../../../lib/rede/feed";
import { createMockSupabaseClient } from "../../../lib/mockSupabase";

/**
 * Integração em processo (cliente mock, sem rede): prova que o formato novo
 * de path da miniatura -- `…-thumb-{LARGURA}x{ALTURA}.jpg` -- sobrevive ao
 * ciclo criar → listar → excluir, e que `listarFeed` extrai as dimensões
 * dele.
 *
 * A validação com Supabase de VERDADE (upload pela rota + RLS + fila de
 * exclusão) exige ambiente com Postgres/Storage -- registrada como
 * pendência de pré-liberação (Supabase local não sobe neste ambiente por
 * conflito de porta do Docker no Windows).
 */

const USER = "user-mock-1";

function clienteMock() {
  return createMockSupabaseClient(
    {
      tables: {
        rede_posts: [],
        rede_post_fotos: [],
        rede_curtidas: [],
        rede_comentarios: [],
        rede_perfis: [
          {
            user_id: USER,
            nome_exibicao: "Eu",
            cor_avatar: "#fff",
            avatar_url: null,
          },
        ],
      },
      cofreFiles: [],
    },
    USER
  );
}

function jpegFake(bytes = 64) {
  return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
}

describe("fotos no feed — ciclo criar → listar → excluir (mock)", () => {
  it("grava a miniatura com as dimensões no nome e o feed as lê de volta", async () => {
    const client = clienteMock();

    const { post, fotos } = await criarPost(client as never, {
      categoria: "geral",
      texto: "post com carrossel",
      fotos: [
        {
          principal: jpegFake(),
          miniatura: jpegFake(),
          largura: 1080,
          altura: 1350,
        },
        {
          principal: jpegFake(),
          miniatura: jpegFake(),
          largura: 1280,
          altura: 720,
        },
      ],
    });

    // as duas fotos voltaram, em ordem, com dimensões e path com sufixo
    expect(fotos).toHaveLength(2);
    expect(fotos[0].largura).toBe(1080);
    expect(fotos[0].altura).toBe(1350);
    expect(fotos[0].thumbPath).toMatch(/-thumb-1080x1350\.jpg$/);
    expect(fotos[1].thumbPath).toMatch(/-thumb-1280x720\.jpg$/);
    expect(dimensoesDaMiniatura(fotos[1].thumbPath)).toEqual({
      largura: 1280,
      altura: 720,
    });

    // o feed relê o post e as fotos com as mesmas dimensões
    const feed = await listarFeed(client as never);
    const doFeed = feed.find((p) => p.id === post.id);
    expect(doFeed?.fotos.map((f) => [f.ordem, f.largura, f.altura])).toEqual([
      [1, 1080, 1350],
      [2, 1280, 720],
    ]);
    // e assina a principal (feed mostra a foto grande), não só a miniatura
    expect(doFeed?.fotos[0].url).toBeTruthy();
    expect(doFeed?.fotos[0].thumbUrl).toBeTruthy();

    // excluir remove o post e as 4 imagens do Storage (2 principal + 2 thumb)
    await excluirPost(client as never, { postId: post.id });
    const depois = await listarFeed(client as never);
    expect(depois.find((p) => p.id === post.id)).toBeUndefined();
  });

  it("foto legada (sem dimensão no nome) → largura/altura null no feed", async () => {
    const client = clienteMock();
    // injeta direto uma linha no formato antigo
    const { post } = await criarPost(client as never, {
      categoria: "geral",
      texto: "legado",
    });
    await (
      client as never as {
        from: (t: string) => { insert: (r: unknown) => PromiseLike<unknown> };
      }
    )
      .from("rede_post_fotos")
      .insert({
        post_id: post.id,
        autor_id: USER,
        path: `${USER}/posts/${post.id}/1-x.jpg`,
        thumb_path: `${USER}/posts/${post.id}/1-x-thumb.jpg`,
        ordem: 1,
      });
    await (
      client as never as {
        storage: {
          from: (b: string) => {
            upload: (p: string, f: Blob) => PromiseLike<unknown>;
          };
        };
      }
    ).storage
      .from("rede-midia")
      .upload(`${USER}/posts/${post.id}/1-x.jpg`, jpegFake());
    await (
      client as never as {
        storage: {
          from: (b: string) => {
            upload: (p: string, f: Blob) => PromiseLike<unknown>;
          };
        };
      }
    ).storage
      .from("rede-midia")
      .upload(`${USER}/posts/${post.id}/1-x-thumb.jpg`, jpegFake());

    const feed = await listarFeed(client as never);
    const foto = feed.find((p) => p.id === post.id)?.fotos[0];
    expect(foto?.largura).toBeNull();
    expect(foto?.altura).toBeNull();
  });
});
