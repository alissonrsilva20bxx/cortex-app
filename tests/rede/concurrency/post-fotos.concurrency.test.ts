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

/**
 * Migration 0028 -- o teste sequencial (rede_post_fotos.rls.test.ts) prova
 * que a 3a foto é rejeitada quando as 2 primeiras já existem. Este prova o
 * caso concorrente: várias tentativas de inserir a MESMA `ordem` (ou mais
 * de 2 fotos) pro mesmo post ao mesmo tempo -- diferente da retenção
 * (0030), aqui não precisa de advisory lock nenhum: a constraint
 * `unique(post_id, ordem)` já é imposta pelo próprio índice do Postgres,
 * que serializa e rejeita duplicatas corretamente mesmo sob concorrência
 * real (ao contrário de um `SELECT count(*) then INSERT if < 2`, que
 * teria a mesma janela de corrida que a retenção tinha).
 */
describe("Concorrência: teto de 2 fotos por post sob inserts simultâneos", () => {
  const testUsers: TestUser[] = [];
  let autor: TestUser;
  let postId: string;

  beforeAll(async () => {
    autor = await createTestUser();
    testUsers.push(autor);

    const admin = redeClient(adminClient());
    const { error: convError } = await admin.from("rede_convites").insert({
      codigo_hash: `rd28-fotos-concorrencia-${autor.id}`,
      usado_por: autor.id,
      usado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (convError) {
      throw new Error(`Failed to seed Rede membership: ${convError.message}`);
    }

    const post = await admin
      .from("rede_posts")
      .insert({
        autor_id: autor.id,
        categoria: "dica",
        texto: "post pra concorrência de fotos",
      })
      .select("id")
      .single();
    if (post.error || !post.data) {
      throw new Error(`Failed to seed post: ${post.error?.message}`);
    }
    postId = post.data.id;
  }, 30_000);

  afterAll(async () => {
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

  it("lets exactly one of several concurrent inserts claim ordem=1", async () => {
    const admin = redeClient(adminClient());
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        admin.from("rede_post_fotos").insert({
          post_id: postId,
          autor_id: autor.id,
          path: `${autor.id}/posts/${postId}/tentativa-${i}.png`,
          ordem: 1,
        })
      )
    );

    const succeeded = attempts.filter(
      (r) => r.status === "fulfilled" && r.value.error === null
    );
    expect(succeeded).toHaveLength(1);

    const rows = await admin
      .from("rede_post_fotos")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    expect(rows.count).toBe(1);
  });

  it("never lets concurrent attempts push a post past 2 photos total", async () => {
    const admin = redeClient(adminClient());
    // ordem=1 já existe (teste anterior). Mais 6 tentativas concorrentes de
    // ordem=2 -- só 1 deveria vingar, resultando em 2 fotos no total (nunca 3+,
    // que o check `ordem in (1,2)` já bloquearia de qualquer forma, mas o
    // que interessa aqui é a corrida por ordem=2 especificamente).
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        admin.from("rede_post_fotos").insert({
          post_id: postId,
          autor_id: autor.id,
          path: `${autor.id}/posts/${postId}/segunda-${i}.png`,
          ordem: 2,
        })
      )
    );

    const succeeded = attempts.filter(
      (r) => r.status === "fulfilled" && r.value.error === null
    );
    expect(succeeded).toHaveLength(1);

    const rows = await admin
      .from("rede_post_fotos")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);
    expect(rows.count).toBe(2);
  });
});
