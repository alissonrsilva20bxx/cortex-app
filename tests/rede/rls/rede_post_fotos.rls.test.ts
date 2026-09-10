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

/** JPEG 1x1 válido -- o bucket rede-midia só aceita image/jpeg (0033). */
const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64"
);

/**
 * Migrations 0028 + 0033 -- fotos em posts. Prova de ponta a ponta contra
 * um Supabase local.
 *
 * A partir da 0033 o cliente NÃO grava foto diretamente: nem
 * `storage.from('rede-midia').upload()` nem `insert` em `rede_post_fotos`.
 * O único caminho é a rota autenticada `app/api/rede/foto-upload`, que usa
 * service_role depois de validar dimensão/tamanho/formato e remover
 * metadados. Aqui os arquivos e linhas são semeados via service_role (o
 * que a rota faz por baixo) e o teste prova:
 *   - authenticated/anon NÃO conseguem upload nem insert direto;
 *   - leitura (linha + arquivo) respeita bloqueio mútuo (0009), inalterado;
 *   - exclusão de foto/post enfileira principal E miniatura em
 *     private.rede_midia_pendente_exclusao, drenável só por service_role.
 */
describe("RLS: fotos em posts (migrations 0028 + 0033)", () => {
  const testUsers: TestUser[] = [];
  let owner: TestUser;
  let blocked: TestUser;
  let otherMember: TestUser;
  let nonMember: TestUser;
  let ownerPostId: string;

  const p = (postId: string, ordem: number) =>
    `${owner.id}/posts/${postId}/${ordem}.jpg`;
  const thumb = (postId: string, ordem: number) =>
    `${owner.id}/posts/${postId}/${ordem}-thumb.jpg`;

  async function seedMembership(userId: string): Promise<void> {
    const { error } = await redeClient(adminClient())
      .from("rede_convites")
      .insert({
        codigo_hash: `rd28-member-${userId}`,
        usado_por: userId,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (error)
      throw new Error(`Failed to seed Rede membership: ${error.message}`);
  }

  /** O que a rota faz: sobe principal + miniatura e insere a linha, tudo
   * via service_role. */
  async function seedFoto(postId: string, ordem: number): Promise<void> {
    const admin = redeClient(adminClient());
    for (const path of [p(postId, ordem), thumb(postId, ordem)]) {
      const up = await admin.storage
        .from("rede-midia")
        .upload(path, ONE_PIXEL_JPEG, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (up.error) throw new Error(`seed upload ${path}: ${up.error.message}`);
    }
    const row = await admin.from("rede_post_fotos").insert({
      post_id: postId,
      autor_id: owner.id,
      path: p(postId, ordem),
      thumb_path: thumb(postId, ordem),
      ordem,
    });
    if (row.error) throw new Error(`seed row ${ordem}: ${row.error.message}`);
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
    if (block.error)
      throw new Error(`Failed to seed block: ${block.error.message}`);

    await seedFoto(ownerPostId, 1);
    await seedFoto(ownerPostId, 2);
  });

  afterAll(async () => {
    await redeClient(adminClient())
      .storage.from("rede-midia")
      .remove([
        p(ownerPostId, 1),
        thumb(ownerPostId, 1),
        p(ownerPostId, 2),
        thumb(ownerPostId, 2),
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

  // ── 0033: cliente não grava direto, de jeito nenhum ──

  it("nega upload direto ao bucket para o próprio dono (0033 tirou a policy de INSERT)", async () => {
    const { error } = await redeClient(owner.client)
      .storage.from("rede-midia")
      .upload(`${owner.id}/posts/${ownerPostId}/9.jpg`, ONE_PIXEL_JPEG, {
        contentType: "image/jpeg",
      });
    expect(error).not.toBeNull();
  });

  it("nega upload direto para outro membro e para não-membro", async () => {
    for (const u of [otherMember, nonMember]) {
      const { error } = await redeClient(u.client)
        .storage.from("rede-midia")
        .upload(`${u.id}/posts/x/1.jpg`, ONE_PIXEL_JPEG, {
          contentType: "image/jpeg",
        });
      expect(error).not.toBeNull();
    }
  });

  it("nega upload direto para anon", async () => {
    const { error } = await redeClient(anonClient())
      .storage.from("rede-midia")
      .upload(`anon/1.jpg`, ONE_PIXEL_JPEG, { contentType: "image/jpeg" });
    expect(error).not.toBeNull();
  });

  it("nega INSERT direto em rede_post_fotos para o próprio dono (0033)", async () => {
    const { error } = await redeClient(owner.client)
      .from("rede_post_fotos")
      .insert({
        post_id: ownerPostId,
        autor_id: owner.id,
        path: `${owner.id}/posts/${ownerPostId}/9.jpg`,
        ordem: 1,
      });
    expectRlsDenied(error);
  });

  it("nega INSERT direto em rede_post_fotos para outro autor", async () => {
    const { error } = await redeClient(otherMember.client)
      .from("rede_post_fotos")
      .insert({
        post_id: ownerPostId,
        autor_id: otherMember.id,
        path: `${otherMember.id}/posts/${ownerPostId}/1.jpg`,
        ordem: 1,
      });
    expectRlsDenied(error);
  });

  // ── constraint de schema (não muda com a 0033) ──

  it("rejeita uma 3a foto no mesmo post (ordem só aceita 1 ou 2)", async () => {
    const { error } = await redeClient(adminClient())
      .from("rede_post_fotos")
      .insert({
        post_id: ownerPostId,
        autor_id: owner.id,
        path: `${owner.id}/posts/${ownerPostId}/3.jpg`,
        ordem: 3,
      });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23514"); // check: ordem in (1,2)
  });

  // ── leitura respeita bloqueio (0009), inalterado pela 0033 ──

  it("deixa um membro não-bloqueado ler a linha e baixar principal + miniatura", async () => {
    const row = await redeClient(otherMember.client)
      .from("rede_post_fotos")
      .select("path,thumb_path")
      .eq("post_id", ownerPostId)
      .eq("ordem", 1)
      .single();
    expect(row.error).toBeNull();
    expect(row.data?.thumb_path).toBe(thumb(ownerPostId, 1));

    for (const path of [p(ownerPostId, 1), thumb(ownerPostId, 1)]) {
      const dl = await redeClient(otherMember.client)
        .storage.from("rede-midia")
        .download(path);
      expect(dl.error).toBeNull();
      expect(dl.data?.size).toBeGreaterThan(0);
    }
  });

  it("esconde a linha e os arquivos de um membro bloqueado (as duas direções)", async () => {
    const row = await redeClient(blocked.client)
      .from("rede_post_fotos")
      .select("path")
      .eq("post_id", ownerPostId);
    expect(row.error).toBeNull();
    expect(row.data).toHaveLength(0);

    for (const path of [p(ownerPostId, 1), thumb(ownerPostId, 1)]) {
      const dl = await redeClient(blocked.client)
        .storage.from("rede-midia")
        .download(path);
      expect(dl.error).not.toBeNull();
    }
  });

  it("nega leitura a um não-membro autenticado", async () => {
    const row = await redeClient(nonMember.client)
      .from("rede_post_fotos")
      .select("path")
      .eq("post_id", ownerPostId);
    expect(row.error).toBeNull();
    expect(row.data).toHaveLength(0);

    const dl = await redeClient(nonMember.client)
      .storage.from("rede-midia")
      .download(p(ownerPostId, 1));
    expect(dl.error).not.toBeNull();
  });

  it("nega todo acesso a anon", async () => {
    const anon = redeClient(anonClient());
    const select = await anon.from("rede_post_fotos").select("path");
    const dl = await anon.storage
      .from("rede-midia")
      .download(p(ownerPostId, 1));
    expect(select.error?.code).toBe("42501");
    expect(dl.error).not.toBeNull();
  });

  it("nega outro membro apagar a linha ou o arquivo do dono", async () => {
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
      .remove([p(ownerPostId, 2)]);
    expect(fileDelete.error).toBeNull();
    expect(fileDelete.data).toHaveLength(0);
  });

  // ── exclusão enfileira principal + miniatura (0033) ──

  it("enfileira principal E miniatura quando o dono apaga a linha da foto; dreno só por service_role", async () => {
    const principal = p(ownerPostId, 2);
    const miniatura = thumb(ownerPostId, 2);

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
    const paths =
      (drained.data as { path: string }[] | null)?.map((r) => r.path) ?? [];
    expect(paths).toContain(principal);
    expect(paths).toContain(miniatura);
  });

  it("cascateia a fila (principal + miniatura) quando o post inteiro é apagado", async () => {
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

    await seedFoto(postId, 1);

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
    const paths =
      (drained.data as { path: string }[] | null)?.map((r) => r.path) ?? [];
    expect(paths).toContain(p(postId, 1));
    expect(paths).toContain(thumb(postId, 1));
  });
});
