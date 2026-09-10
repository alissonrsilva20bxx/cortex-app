import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

function redeClient(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

// JPEG 1x1 -- o bucket rede-midia só aceita image/jpeg (migration 0033).
const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64"
);

/**
 * Migration 0028 -- retenção global: nunca mais que 300 linhas em
 * rede_posts. Decisão assumida nesta implementação (global, não por
 * autora) documentada no cabeçalho da própria migration -- este teste
 * prova o comportamento como especificado, não o "correto" definitivo,
 * que ainda depende de confirmação de produto antes do banco
 * compartilhado (ver instrução do usuário nesta rodada).
 *
 * Roda contra o Supabase local descartável; não deve, sob nenhuma
 * circunstância, ser apontado para o banco remoto.
 */
describe("Retenção: no máximo 300 posts (migration 0028)", () => {
  const testUsers: TestUser[] = [];
  let autor: TestUser;

  beforeAll(async () => {
    autor = await createTestUser();
    testUsers.push(autor);

    const admin = redeClient(adminClient());
    const { error: convError } = await admin.from("rede_convites").insert({
      codigo_hash: `rd28-retencao-${autor.id}`,
      usado_por: autor.id,
      usado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (convError) {
      throw new Error(`Failed to seed Rede membership: ${convError.message}`);
    }

    // Zera qualquer post pré-existente de execuções anteriores contra esse
    // mesmo Supabase local, pra a contagem final ser determinística.
    const { error: cleanupError } = await admin
      .from("rede_posts")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (cleanupError) {
      throw new Error(`Failed to reset rede_posts: ${cleanupError.message}`);
    }

    // Migration 0028/0031: o trigger nasce DESATIVADO por padrão (ver
    // rationale nos próprios arquivos) -- este teste existe justamente
    // pra provar o comportamento do trigger, então liga ele deliberada e
    // explicitamente só pro escopo deste describe.
    const { error: enableError } = await admin.rpc(
      "rede_posts_retencao_definir_habilitada",
      { habilitada: true }
    );
    if (enableError) {
      throw new Error(
        `Failed to enable rede_posts_retention trigger: ${enableError.message}`
      );
    }
  }, 30_000);

  afterAll(async () => {
    const admin = redeClient(adminClient());
    // Restaura o padrão desativado -- não deixar o trigger ligado pra
    // outros arquivos de teste que rodem depois contra o mesmo Supabase
    // local.
    await admin.rpc("rede_posts_retencao_definir_habilitada", {
      habilitada: false,
    });

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

  it("trims the oldest posts (and queues their photos for cleanup) once the 301st post lands", async () => {
    const admin = redeClient(adminClient());
    const base = Date.now();

    // 300 posts "antigos", timestamps estritamente crescentes pra ordem
    // determinística -- o mais antigo de todos (índice 0) é o único com
    // foto, pra provar que a limpeza de mídia acompanha a retenção.
    const antigos = Array.from({ length: 300 }, (_, i) => ({
      autor_id: autor.id,
      categoria: "dica" as const,
      texto: `post antigo #${i}`,
      criado_em: new Date(base - (300 - i) * 1000).toISOString(),
    }));
    const inserted = await admin
      .from("rede_posts")
      .insert(antigos)
      .select("id, criado_em")
      .order("criado_em", { ascending: true });
    expect(inserted.error).toBeNull();
    expect(inserted.data).toHaveLength(300);

    const oldestPostId = inserted.data![0].id;
    const oldestPath = `${autor.id}/posts/${oldestPostId}/1.jpg`;
    const upload = await admin.storage
      .from("rede-midia")
      .upload(oldestPath, ONE_PIXEL_JPEG, { contentType: "image/jpeg" });
    expect(upload.error).toBeNull();
    const foto = await admin.from("rede_post_fotos").insert({
      post_id: oldestPostId,
      autor_id: autor.id,
      path: oldestPath,
      ordem: 1,
    });
    expect(foto.error).toBeNull();

    const before = await admin
      .from("rede_posts")
      .select("id", { count: "exact", head: true });
    expect(before.count).toBe(300);

    // O 301o post -- dispara o trigger AFTER INSERT, que deve apagar
    // exatamente 1 linha (a mais antiga de todas, `oldestPostId`).
    const newest = await admin
      .from("rede_posts")
      .insert({
        autor_id: autor.id,
        categoria: "dica",
        texto: "post que estoura os 300",
        criado_em: new Date(base + 1000).toISOString(),
      })
      .select("id")
      .single();
    expect(newest.error).toBeNull();

    const after = await admin
      .from("rede_posts")
      .select("id", { count: "exact", head: true });
    expect(after.count).toBe(300);

    const stillThere = await admin
      .from("rede_posts")
      .select("id")
      .eq("id", oldestPostId);
    expect(stillThere.data).toHaveLength(0);

    const stillThereNewest = await admin
      .from("rede_posts")
      .select("id")
      .eq("id", newest.data!.id);
    expect(stillThereNewest.data).toHaveLength(1);

    // A foto do post apagado pela retenção precisa ter sido enfileirada
    // pra limpeza -- mesmo mecanismo usado por excluirPost manual.
    const drained = await admin.rpc("rede_midia_drenar_pendentes", {
      lote: 50,
    });
    expect(drained.error).toBeNull();
    expect(
      (drained.data as { path: string }[] | null)?.map((r) => r.path)
    ).toContain(oldestPath);
  }, 30_000);
});
