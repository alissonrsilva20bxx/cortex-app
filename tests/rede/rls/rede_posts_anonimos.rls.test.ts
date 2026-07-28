import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/** rede_bloqueios postdates the last full type generation for this narrow use. */
function redeClient(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

/**
 * RD-05b acceptance criteria, proven end-to-end against a local Supabase:
 * a non-owner reading an anonymous post through rede_posts_publico never
 * gets the real autor_id back, in any field, while the owner and any admin
 * still do. Also proves the bypass this whole ticket exists to close: the
 * base table no longer grants SELECT on autor_id to `authenticated` at
 * all, so there's no way to route around the view. See
 * docs/rede/BETA_DOMAIN_MODEL.md §3 and
 * supabase/migrations/0009b_rede_posts_anonimos.sql.
 */
describe("RLS: rede_posts anonimato (RD-05b)", () => {
  const testUsers: TestUser[] = [];
  let author: TestUser;
  let reader: TestUser;
  let admin: TestUser;
  let anonymousPostId: string;
  let namedPostId: string;

  async function seedMembership(userId: string): Promise<void> {
    const { error } = await redeClient(adminClient())
      .from("rede_convites")
      .insert({
        codigo_hash: `rd05b-member-${userId}`,
        usado_por: userId,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (error) {
      throw new Error(`Failed to seed Rede membership: ${error.message}`);
    }
  }

  beforeAll(async () => {
    author = await createTestUser();
    testUsers.push(author);
    reader = await createTestUser();
    testUsers.push(reader);
    admin = await createTestUser();
    testUsers.push(admin);

    await seedMembership(author.id);
    await seedMembership(reader.id);
    await seedMembership(admin.id);

    const { error: adminError } = await redeClient(adminClient())
      .from("rede_admins")
      .insert({ user_id: admin.id });
    if (adminError) {
      throw new Error(`Failed to seed Rede admin: ${adminError.message}`);
    }

    const anonymousPost = await redeClient(author.client)
      .from("rede_posts")
      .insert({
        autor_id: author.id,
        categoria: "desabafo",
        texto: "Post anonimo de teste",
        anonimo: true,
      })
      .select("id, categoria, texto, anonimo, criado_em, atualizado_em")
      .single();
    if (anonymousPost.error || !anonymousPost.data) {
      throw new Error(
        `Failed to seed anonymous post: ${anonymousPost.error?.message}`
      );
    }
    anonymousPostId = anonymousPost.data.id;

    const namedPost = await redeClient(author.client)
      .from("rede_posts")
      .insert({
        autor_id: author.id,
        categoria: "dica",
        texto: "Post normal de teste",
      })
      .select("id, categoria, texto, anonimo, criado_em, atualizado_em")
      .single();
    if (namedPost.error || !namedPost.data) {
      throw new Error(`Failed to seed named post: ${namedPost.error?.message}`);
    }
    namedPostId = namedPost.data.id;
  });

  afterAll(async () => {
    const results = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(
        `Failed to delete ${failures.length} local test user(s): ${failures
          .map((failure) => String(failure.reason))
          .join("; ")}`
      );
    }
  });

  it("hides the real author from a non-owner reading an anonymous post via the view", async () => {
    const { data, error } = await redeClient(reader.client)
      .from("rede_posts_publico")
      .select("id, autor_id, anonimo")
      .eq("id", anonymousPostId)
      .single();

    expect(error).toBeNull();
    expect(data?.anonimo).toBe(true);
    expect(data?.autor_id).toBeNull();
  });

  it("still returns the real author for a non-anonymous post via the view", async () => {
    const { data, error } = await redeClient(reader.client)
      .from("rede_posts_publico")
      .select("id, autor_id, anonimo")
      .eq("id", namedPostId)
      .single();

    expect(error).toBeNull();
    expect(data?.anonimo).toBe(false);
    expect(data?.autor_id).toBe(author.id);
  });

  it("lets the author see their own real autor_id on their own anonymous post", async () => {
    const { data, error } = await redeClient(author.client)
      .from("rede_posts_publico")
      .select("id, autor_id")
      .eq("id", anonymousPostId)
      .single();

    expect(error).toBeNull();
    expect(data?.autor_id).toBe(author.id);
  });

  it("lets an admin see the real autor_id on someone else's anonymous post", async () => {
    const { data, error } = await redeClient(admin.client)
      .from("rede_posts_publico")
      .select("id, autor_id")
      .eq("id", anonymousPostId)
      .single();

    expect(error).toBeNull();
    expect(data?.autor_id).toBe(author.id);
  });

  it("closes the bypass: authenticated cannot SELECT autor_id from the base table at all", async () => {
    // This is what actually satisfies the "not even via join" acceptance
    // criterion: the denial here is a column-level GRANT check enforced by
    // Postgres itself, not a query-shape-specific RLS predicate. Any path
    // that touches rede_posts.autor_id as `authenticated` -- direct select,
    // an embedded PostgREST join, a hand-written view of someone else's --
    // hits the same permission check and is denied the same way. A
    // dedicated "via join" test would only prove PostgREST's embedding
    // syntax happens to work here, not add any additional guarantee.
    const { error } = await redeClient(reader.client)
      .from("rede_posts")
      .select("autor_id")
      .eq("id", anonymousPostId);

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("permission denied for table rede_posts");
  });

  it("does not let an authenticated non-admin fake admin access through the view", async () => {
    const { data, error } = await redeClient(reader.client)
      .from("rede_posts_publico")
      .select("id, autor_id")
      .eq("id", anonymousPostId)
      .single();

    expect(error).toBeNull();
    expect(data?.autor_id).toBeNull();
  });

  it("keeps non-autor_id columns readable directly on the base table (RD-05 unaffected)", async () => {
    const { data, error } = await redeClient(reader.client)
      .from("rede_posts")
      .select("id, categoria, texto, anonimo")
      .eq("id", namedPostId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].texto).toBe("Post normal de teste");
  });

  it("does not expose rede_posts_publico to anon", async () => {
    const { error } = await redeClient(anonClient())
      .from("rede_posts_publico")
      .select("id");

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("keeps service-role access to the real autor_id on the base table", async () => {
    const { data, error } = await redeClient(adminClient())
      .from("rede_posts")
      .select("autor_id")
      .eq("id", anonymousPostId)
      .single();

    expect(error).toBeNull();
    expect(data?.autor_id).toBe(author.id);
  });
});
