import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

function redeClient(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

function expectRlsDenied(error: { code?: string } | null): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
}

/** Menor PNG válido possível (1x1, transparente) -- evita surpresa de MIME-sniffing. */
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

/**
 * Migration 0028 -- fotos em posts. Prova de ponta a ponta contra um
 * Supabase local: no máximo 2 fotos por post (schema, não app), upload só
 * sob o path {user_id}/posts/{post_id}/... de um post que o uploader
 * realmente é dono, leitura (linha + arquivo) respeita bloqueio mútuo
 * igual a rede_posts/rede_comentarios (0009), e a exclusão -- de uma foto
 * ou em cascata de um post inteiro -- enfileira o path em
 * private.rede_midia_pendente_exclusao, drenável só por service_role via
 * rede_midia_drenar_pendentes().
 */
describe("RLS: migration 0028 fotos em posts", () => {
  const testUsers: TestUser[] = [];
  let owner: TestUser;
  let blocked: TestUser; // owner bloqueia este usuário
  let otherMember: TestUser; // nao bloqueado, deve enxergar tudo
  let nonMember: TestUser;
  let ownerPostId: string;

  async function seedMembership(userId: string): Promise<void> {
    const { error } = await redeClient(adminClient())
      .from("rede_convites")
      .insert({
        codigo_hash: `rd28-member-${userId}`,
        usado_por: userId,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (error) {
      throw new Error(`Failed to seed Rede membership: ${error.message}`);
    }
  }

  beforeAll(async () => {
    owner = await createTestUser();
    testUsers.push(owner);
    blocked = await createTestUser();
    testUsers.push(blocked);
    otherMember = await createTestUser();
    testUsers.push(otherMember);
    nonMember = await createTestUser();
    testUsers.push(nonMember);

    await seedMembership(owner.id);
    await seedMembership(blocked.id);
    await seedMembership(otherMember.id);
    // nonMember nunca resgata convite.

    const post = await redeClient(owner.client)
      .from("rede_posts")
      .insert({
        autor_id: owner.id,
        categoria: "dica",
        texto: "post com fotos",
      })
      .select("id")
      .single();
    if (post.error || !post.data) {
      throw new Error(`Failed to seed post: ${post.error?.message}`);
    }
    ownerPostId = post.data.id;

    const block = await redeClient(owner.client)
      .from("rede_bloqueios")
      .insert({ bloqueador_id: owner.id, bloqueado_id: blocked.id });
    if (block.error) {
      throw new Error(`Failed to seed block: ${block.error.message}`);
    }
  });

  afterAll(async () => {
    await redeClient(adminClient())
      .storage.from("rede-midia")
      .remove([
        `${owner.id}/posts/${ownerPostId}/1.png`,
        `${owner.id}/posts/${ownerPostId}/2.png`,
      ]);

    const failures: unknown[] = [];
    for (const user of testUsers) {
      try {
        await deleteTestUser(user);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("rejects an upload under another member's user_id path", async () => {
    const forged = `${owner.id}/posts/${ownerPostId}/forjado.png`;
    const { error } = await redeClient(otherMember.client)
      .storage.from("rede-midia")
      .upload(forged, ONE_PIXEL_PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("rejects an upload referencing a post the uploader doesn't own", async () => {
    const path = `${otherMember.id}/posts/${ownerPostId}/pixel.png`;
    const { error } = await redeClient(otherMember.client)
      .storage.from("rede-midia")
      .upload(path, ONE_PIXEL_PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("rejects an upload from an authenticated non-member", async () => {
    const path = `${nonMember.id}/posts/x/pixel.png`;
    const { error } = await redeClient(nonMember.client)
      .storage.from("rede-midia")
      .upload(path, ONE_PIXEL_PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("lets the owner upload up to 2 photos for their own post and insert the matching rows", async () => {
    for (const ordem of [1, 2] as const) {
      const path = `${owner.id}/posts/${ownerPostId}/${ordem}.png`;
      const upload = await redeClient(owner.client)
        .storage.from("rede-midia")
        .upload(path, ONE_PIXEL_PNG, { contentType: "image/png" });
      expect(upload.error).toBeNull();

      const row = await redeClient(owner.client)
        .from("rede_post_fotos")
        .insert({ post_id: ownerPostId, autor_id: owner.id, path, ordem })
        .select("id")
        .single();
      expect(row.error).toBeNull();
    }
  });

  it("rejects a 3rd photo on the same post (ordem só aceita 1 ou 2)", async () => {
    const path = `${owner.id}/posts/${ownerPostId}/3.png`;
    const { error } = await redeClient(owner.client)
      .from("rede_post_fotos")
      .insert({ post_id: ownerPostId, autor_id: owner.id, path, ordem: 3 });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23514"); // check constraint: ordem in (1,2)
  });

  it("rejects a foto row forged on behalf of another author", async () => {
    const path = `${otherMember.id}/posts/${ownerPostId}/forjado.png`;
    const { error } = await redeClient(otherMember.client)
      .from("rede_post_fotos")
      .insert({
        post_id: ownerPostId,
        autor_id: otherMember.id,
        path,
        ordem: 1,
      });
    expectRlsDenied(error);
  });

  it("lets an unblocked member read the row and download the file", async () => {
    const row = await redeClient(otherMember.client)
      .from("rede_post_fotos")
      .select("path")
      .eq("post_id", ownerPostId)
      .eq("ordem", 1)
      .single();
    expect(row.error).toBeNull();

    const download = await redeClient(otherMember.client)
      .storage.from("rede-midia")
      .download(`${owner.id}/posts/${ownerPostId}/1.png`);
    expect(download.error).toBeNull();
    expect(download.data?.size).toBeGreaterThan(0);
  });

  it("hides the row and the file from a blocked member (both directions)", async () => {
    const row = await redeClient(blocked.client)
      .from("rede_post_fotos")
      .select("path")
      .eq("post_id", ownerPostId)
      .eq("ordem", 1);
    expect(row.error).toBeNull();
    expect(row.data).toHaveLength(0);

    const download = await redeClient(blocked.client)
      .storage.from("rede-midia")
      .download(`${owner.id}/posts/${ownerPostId}/1.png`);
    expect(download.error).not.toBeNull();
  });

  it("denies read access to an authenticated non-member", async () => {
    const row = await redeClient(nonMember.client)
      .from("rede_post_fotos")
      .select("path")
      .eq("post_id", ownerPostId);
    expect(row.error).toBeNull();
    expect(row.data).toHaveLength(0);

    const download = await redeClient(nonMember.client)
      .storage.from("rede-midia")
      .download(`${owner.id}/posts/${ownerPostId}/1.png`);
    expect(download.error).not.toBeNull();
  });

  it("denies all access to anon", async () => {
    const anon = redeClient(anonClient());
    const select = await anon.from("rede_post_fotos").select("path");
    const download = await anon.storage
      .from("rede-midia")
      .download(`${owner.id}/posts/${ownerPostId}/1.png`);

    expect(select.error?.code).toBe("42501");
    expect(download.error).not.toBeNull();
  });

  it("rejects another member deleting the owner's photo row or file", async () => {
    const rowDelete = await redeClient(otherMember.client)
      .from("rede_post_fotos")
      .delete()
      .eq("post_id", ownerPostId)
      .eq("ordem", 2)
      .select("id");
    expect(rowDelete.error).toBeNull();
    expect(rowDelete.data).toHaveLength(0);

    const fileDelete = await redeClient(otherMember.client)
      .storage.from("rede-midia")
      .remove([`${owner.id}/posts/${ownerPostId}/2.png`]);
    expect(fileDelete.error).toBeNull();
    expect(fileDelete.data).toHaveLength(0);
  });

  it("queues the path for cleanup when the owner deletes a photo row, drainable only by service_role", async () => {
    const path = `${owner.id}/posts/${ownerPostId}/2.png`;

    const deleted = await redeClient(owner.client)
      .from("rede_post_fotos")
      .delete()
      .eq("post_id", ownerPostId)
      .eq("ordem", 2)
      .select("id");
    expect(deleted.error).toBeNull();
    expect(deleted.data).toHaveLength(1);

    const deniedDrain = await redeClient(owner.client).rpc(
      "rede_midia_drenar_pendentes",
      { lote: 10 }
    );
    expect(deniedDrain.error).not.toBeNull();

    const drained = await redeClient(adminClient()).rpc(
      "rede_midia_drenar_pendentes",
      { lote: 50 }
    );
    expect(drained.error).toBeNull();
    expect(
      (drained.data as { path: string }[] | null)?.map((r) => r.path)
    ).toContain(path);

    // Drenado uma vez -- não reaparece numa 2a chamada (DELETE ... RETURNING
    // já consumiu a linha da fila).
    const drainedAgain = await redeClient(adminClient()).rpc(
      "rede_midia_drenar_pendentes",
      { lote: 50 }
    );
    expect(
      (drainedAgain.data as { path: string }[] | null)?.map((r) => r.path)
    ).not.toContain(path);
  });

  it("cascades the queue when the whole post is deleted", async () => {
    const post = await redeClient(owner.client)
      .from("rede_posts")
      .insert({
        autor_id: owner.id,
        categoria: "dica",
        texto: "post descartável",
      })
      .select("id")
      .single();
    expect(post.error).toBeNull();
    const postId = post.data!.id;
    const path = `${owner.id}/posts/${postId}/1.png`;

    const upload = await redeClient(owner.client)
      .storage.from("rede-midia")
      .upload(path, ONE_PIXEL_PNG, { contentType: "image/png" });
    expect(upload.error).toBeNull();
    const foto = await redeClient(owner.client)
      .from("rede_post_fotos")
      .insert({ post_id: postId, autor_id: owner.id, path, ordem: 1 });
    expect(foto.error).toBeNull();

    const del = await redeClient(owner.client)
      .from("rede_posts")
      .delete()
      .eq("id", postId)
      .select("id");
    expect(del.error).toBeNull();
    expect(del.data).toEqual([{ id: postId }]);

    const drained = await redeClient(adminClient()).rpc(
      "rede_midia_drenar_pendentes",
      { lote: 50 }
    );
    expect(
      (drained.data as { path: string }[] | null)?.map((r) => r.path)
    ).toContain(path);
  });
});
