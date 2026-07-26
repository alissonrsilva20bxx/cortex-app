import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * rede_posts/rede_comentarios/rede_curtidas postdate the last
 * `lib/database.types.ts` generation (that regeneration is RD-09, gated on
 * every MVP migration landing). Calling them through the generated
 * `Database` type doesn't typecheck yet, so this file talks to them through
 * an untyped view of the same client.
 */
function redeClient(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

function expectRlsDenied(error: { code?: string } | null): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
}

function expectPermissionDenied(
  error: { code?: string; message: string } | null,
  table: string
): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
  expect(error?.message).toContain(`permission denied for table ${table}`);
}

/**
 * RD-05 acceptance criteria, proven end-to-end against a local Supabase: a
 * user blocked by A never shows up when A reads posts/comments, even though
 * the row still exists; a duplicate like from the same user on the same
 * post is rejected by the composite primary key. See
 * docs/rede/SUPABASE_MIGRATION_PLAN.md §2.
 */
describe("RLS: RD-05 conteudo (posts, comentarios, curtidas)", () => {
  const testUsers: TestUser[] = [];
  let blockerA: TestUser;
  let blockedAuthor: TestUser;
  let neutralReader: TestUser;
  let nonMember: TestUser;
  let blockedPostId: string;
  let blockerPostId: string;
  let neutralPostId: string;
  let blockedCommentId: string;
  let hiddenByPostCommentId: string;
  let blockerOnBlockedCommentId: string;
  let blockedOnBlockerCommentId: string;

  async function seedMembership(userId: string): Promise<void> {
    const { error } = await redeClient(adminClient())
      .from("rede_convites")
      .insert({
        codigo_hash: `rd05-member-${userId}`,
        usado_por: userId,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (error) {
      throw new Error(`Failed to seed Rede membership: ${error.message}`);
    }
  }

  beforeAll(async () => {
    blockerA = await createTestUser();
    testUsers.push(blockerA);
    blockedAuthor = await createTestUser();
    testUsers.push(blockedAuthor);
    neutralReader = await createTestUser();
    testUsers.push(neutralReader);
    nonMember = await createTestUser();
    testUsers.push(nonMember);

    await seedMembership(blockerA.id);
    await seedMembership(blockedAuthor.id);
    await seedMembership(neutralReader.id);
    // nonMember never redeems an invite.

    const blockedPost = await redeClient(blockedAuthor.client)
      .from("rede_posts")
      .insert({
        autor_id: blockedAuthor.id,
        categoria: "dica",
        texto: "Post do autor que sera bloqueado",
      })
      .select("id")
      .single();
    if (blockedPost.error || !blockedPost.data) {
      throw new Error(
        `Failed to seed blocked-author post: ${blockedPost.error?.message}`
      );
    }
    blockedPostId = blockedPost.data.id;

    const blockerPost = await redeClient(blockerA.client)
      .from("rede_posts")
      .insert({
        autor_id: blockerA.id,
        categoria: "dica",
        texto: "Post do bloqueador",
      })
      .select("id")
      .single();
    if (blockerPost.error || !blockerPost.data) {
      throw new Error(
        `Failed to seed blocker post: ${blockerPost.error?.message}`
      );
    }
    blockerPostId = blockerPost.data.id;

    const neutralPost = await redeClient(neutralReader.client)
      .from("rede_posts")
      .insert({
        autor_id: neutralReader.id,
        categoria: "conquista",
        texto: "Post do leitor neutro",
      })
      .select("id")
      .single();
    if (neutralPost.error || !neutralPost.data) {
      throw new Error(
        `Failed to seed neutral post: ${neutralPost.error?.message}`
      );
    }
    neutralPostId = neutralPost.data.id;

    const blockedComment = await redeClient(blockedAuthor.client)
      .from("rede_comentarios")
      .insert({
        post_id: neutralPostId,
        autor_id: blockedAuthor.id,
        texto: "Comentario do autor que sera bloqueado",
      })
      .select("id")
      .single();
    if (blockedComment.error || !blockedComment.data) {
      throw new Error(
        `Failed to seed blocked-author comment: ${blockedComment.error?.message}`
      );
    }
    blockedCommentId = blockedComment.data.id;

    const hiddenByPostComment = await redeClient(neutralReader.client)
      .from("rede_comentarios")
      .insert({
        post_id: blockedPostId,
        autor_id: neutralReader.id,
        texto: "Comentario neutro em post que ficara invisivel",
      })
      .select("id")
      .single();
    if (hiddenByPostComment.error || !hiddenByPostComment.data) {
      throw new Error(
        `Failed to seed hidden-by-post comment: ${hiddenByPostComment.error?.message}`
      );
    }
    hiddenByPostCommentId = hiddenByPostComment.data.id;

    const crossComments = await Promise.all([
      redeClient(blockerA.client)
        .from("rede_comentarios")
        .insert({
          post_id: blockedPostId,
          autor_id: blockerA.id,
          texto: "antes do bloqueio A para B",
        })
        .select("id")
        .single(),
      redeClient(blockedAuthor.client)
        .from("rede_comentarios")
        .insert({
          post_id: blockerPostId,
          autor_id: blockedAuthor.id,
          texto: "antes do bloqueio B para A",
        })
        .select("id")
        .single(),
    ]);
    if (crossComments.some((result) => result.error || !result.data)) {
      throw new Error("Failed to seed cross-comments before block");
    }
    blockerOnBlockedCommentId = crossComments[0].data!.id;
    blockedOnBlockerCommentId = crossComments[1].data!.id;

    const hiddenLike = await redeClient(neutralReader.client)
      .from("rede_curtidas")
      .insert({ post_id: blockedPostId, user_id: neutralReader.id });
    if (hiddenLike.error) throw hiddenLike.error;
    const blockedAuthorLike = await redeClient(blockedAuthor.client)
      .from("rede_curtidas")
      .insert({ post_id: neutralPostId, user_id: blockedAuthor.id });
    if (blockedAuthorLike.error) throw blockedAuthorLike.error;
    const blockerLike = await redeClient(blockerA.client)
      .from("rede_curtidas")
      .insert({ post_id: neutralPostId, user_id: blockerA.id });
    if (blockerLike.error) throw blockerLike.error;

    const block = await redeClient(blockerA.client)
      .from("rede_bloqueios")
      .insert({ bloqueador_id: blockerA.id, bloqueado_id: blockedAuthor.id });
    if (block.error) {
      throw new Error(`Failed to seed block: ${block.error.message}`);
    }
  });

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

  describe("rede_posts", () => {
    it("hides posts from an author the reader has blocked", async () => {
      const blocker = await redeClient(blockerA.client)
        .from("rede_posts")
        .select("id")
        .eq("id", blockedPostId);
      const neutral = await redeClient(neutralReader.client)
        .from("rede_posts")
        .select("id")
        .eq("id", blockedPostId);

      expect(blocker.error).toBeNull();
      expect(blocker.data).toHaveLength(0);
      expect(neutral.error).toBeNull();
      expect(neutral.data).toEqual([{ id: blockedPostId }]);
    });

    it("still lets the blocked author read their own post", async () => {
      const { data, error } = await redeClient(blockedAuthor.client)
        .from("rede_posts")
        .select("id")
        .eq("id", blockedPostId);

      expect(error).toBeNull();
      expect(data).toEqual([{ id: blockedPostId }]);
    });

    it("rejects a post insert forged on behalf of another author", async () => {
      const { error } = await redeClient(neutralReader.client)
        .from("rede_posts")
        .insert({
          autor_id: blockerA.id,
          categoria: "dica",
          texto: "forjado",
        });

      expectRlsDenied(error);
    });

    it("rejects a post insert from an authenticated non-member", async () => {
      const { error } = await redeClient(nonMember.client)
        .from("rede_posts")
        .insert({
          autor_id: nonMember.id,
          categoria: "duvida",
          texto: "nao deveria existir",
        });

      expectRlsDenied(error);
    });

    it("hides posts entirely from an authenticated non-member", async () => {
      const { data, error } = await redeClient(nonMember.client)
        .from("rede_posts")
        .select("id")
        .eq("id", neutralPostId);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("lets only the owner update or delete their post", async () => {
      const outsiderUpdate = await redeClient(blockerA.client)
        .from("rede_posts")
        .update({ texto: "hijacked" })
        .eq("id", neutralPostId)
        .select("id");
      const ownerUpdate = await redeClient(neutralReader.client)
        .from("rede_posts")
        .update({ texto: "editado pelo dono" })
        .eq("id", neutralPostId)
        .select("id");

      expect(outsiderUpdate.error).toBeNull();
      expect(outsiderUpdate.data).toHaveLength(0);
      expect(ownerUpdate.error).toBeNull();
      expect(ownerUpdate.data).toEqual([{ id: neutralPostId }]);
    });

    it("does not expose rede_posts to anon", async () => {
      const anon = redeClient(anonClient());
      const select = await anon.from("rede_posts").select("id");
      const insert = await anon.from("rede_posts").insert({
        autor_id: neutralReader.id,
        categoria: "dica",
        texto: "anon",
      });

      expectPermissionDenied(select.error, "rede_posts");
      expectPermissionDenied(insert.error, "rede_posts");
    });
  });

  describe("rede_comentarios", () => {
    it("hides comments from an author the reader has blocked", async () => {
      const blocker = await redeClient(blockerA.client)
        .from("rede_comentarios")
        .select("id")
        .eq("id", blockedCommentId);
      const neutral = await redeClient(neutralReader.client)
        .from("rede_comentarios")
        .select("id")
        .eq("id", blockedCommentId);

      expect(blocker.error).toBeNull();
      expect(blocker.data).toHaveLength(0);
      expect(neutral.error).toBeNull();
      expect(neutral.data).toEqual([{ id: blockedCommentId }]);
    });

    it("does not leak comments whose post is invisible", async () => {
      const hidden = await redeClient(blockerA.client)
        .from("rede_comentarios")
        .select("id")
        .eq("id", hiddenByPostCommentId);
      expect(hidden.error).toBeNull();
      expect(hidden.data).toHaveLength(0);
    });

    it("rejects comments across a mutual block in both directions", async () => {
      const blockerToBlocked = await redeClient(blockerA.client)
        .from("rede_comentarios")
        .insert({
          post_id: blockedPostId,
          autor_id: blockerA.id,
          texto: "nao permitido",
        });
      const blockedToBlocker = await redeClient(blockedAuthor.client)
        .from("rede_comentarios")
        .insert({
          post_id: blockerPostId,
          autor_id: blockedAuthor.id,
          texto: "tambem nao permitido",
        });
      expectRlsDenied(blockerToBlocked.error);
      expectRlsDenied(blockedToBlocker.error);
    });

    it("does not grant moving a comment onto an invisible post", async () => {
      const blockerMove = await redeClient(blockerA.client)
        .from("rede_comentarios")
        .update({ post_id: blockedPostId })
        .eq("id", blockedCommentId);
      const blockedMove = await redeClient(blockedAuthor.client)
        .from("rede_comentarios")
        .update({ post_id: blockerPostId })
        .eq("id", blockedCommentId);
      expectPermissionDenied(blockerMove.error, "rede_comentarios");
      expectPermissionDenied(blockedMove.error, "rede_comentarios");
    });

    it("denies owner text updates across a mutual block in both directions", async () => {
      const blockerUpdate = await redeClient(blockerA.client)
        .from("rede_comentarios")
        .update({ texto: "alterado depois do bloqueio" })
        .eq("id", blockerOnBlockedCommentId)
        .select("id");
      const blockedUpdate = await redeClient(blockedAuthor.client)
        .from("rede_comentarios")
        .update({ texto: "alterado depois do bloqueio" })
        .eq("id", blockedOnBlockerCommentId)
        .select("id");
      expect(blockerUpdate.error).toBeNull();
      expect(blockerUpdate.data).toHaveLength(0);
      expect(blockedUpdate.error).toBeNull();
      expect(blockedUpdate.data).toHaveLength(0);
    });

    it("lets an unblocked owner update comment text", async () => {
      const updated = await redeClient(neutralReader.client)
        .from("rede_comentarios")
        .update({ texto: "edição permitida" })
        .eq("id", hiddenByPostCommentId)
        .select("id");
      expect(updated.error).toBeNull();
      expect(updated.data).toEqual([{ id: hiddenByPostCommentId }]);
    });

    it("rejects a comment insert forged on behalf of another author", async () => {
      const { error } = await redeClient(neutralReader.client)
        .from("rede_comentarios")
        .insert({
          post_id: neutralPostId,
          autor_id: blockerA.id,
          texto: "forjado",
        });

      expectRlsDenied(error);
    });

    it("lets only the owner update or delete their comment", async () => {
      const outsiderDelete = await redeClient(neutralReader.client)
        .from("rede_comentarios")
        .delete()
        .eq("id", blockedCommentId)
        .select("id");
      const ownerDelete = await redeClient(blockedAuthor.client)
        .from("rede_comentarios")
        .delete()
        .eq("id", blockedCommentId)
        .select("id");

      expect(outsiderDelete.error).toBeNull();
      expect(outsiderDelete.data).toHaveLength(0);
      expect(ownerDelete.error).toBeNull();
      expect(ownerDelete.data).toEqual([{ id: blockedCommentId }]);
    });
  });

  describe("rede_curtidas", () => {
    it("lets a member like a post exactly once and rejects a duplicate", async () => {
      const first = await redeClient(neutralReader.client)
        .from("rede_curtidas")
        .insert({ post_id: neutralPostId, user_id: neutralReader.id });
      const duplicate = await redeClient(neutralReader.client)
        .from("rede_curtidas")
        .insert({ post_id: neutralPostId, user_id: neutralReader.id });

      expect(first.error).toBeNull();
      expect(duplicate.error).not.toBeNull();
      expect(duplicate.error?.code).toBe("23505");
    });

    it("rejects a like forged on behalf of another user", async () => {
      const { error } = await redeClient(blockerA.client)
        .from("rede_curtidas")
        .insert({ post_id: neutralPostId, user_id: neutralReader.id });

      expectRlsDenied(error);
    });

    it("shows likes only when the underlying post is visible", async () => {
      const { data, error } = await redeClient(blockerA.client)
        .from("rede_curtidas")
        .select("post_id,user_id")
        .eq("post_id", neutralPostId);

      expect(error).toBeNull();
      expect(data?.map((row) => row.user_id).sort()).toEqual(
        [blockerA.id, neutralReader.id].sort()
      );

      const reverse = await redeClient(blockedAuthor.client)
        .from("rede_curtidas")
        .select("user_id")
        .eq("post_id", neutralPostId);
      expect(reverse.error).toBeNull();
      expect(reverse.data?.map((row) => row.user_id).sort()).toEqual(
        [blockedAuthor.id, neutralReader.id].sort()
      );

      const hidden = await redeClient(blockerA.client)
        .from("rede_curtidas")
        .select("post_id")
        .eq("post_id", blockedPostId);
      expect(hidden.error).toBeNull();
      expect(hidden.data).toHaveLength(0);
    });

    it("rejects likes on an invisible post in both block directions", async () => {
      const blockerLike = await redeClient(blockerA.client)
        .from("rede_curtidas")
        .insert({ post_id: blockedPostId, user_id: blockerA.id });
      const blockedLike = await redeClient(blockedAuthor.client)
        .from("rede_curtidas")
        .insert({ post_id: blockerPostId, user_id: blockedAuthor.id });
      expectRlsDenied(blockerLike.error);
      expectRlsDenied(blockedLike.error);
    });

    it("lets only the owner remove their own like", async () => {
      const outsider = await redeClient(blockerA.client)
        .from("rede_curtidas")
        .delete()
        .eq("post_id", neutralPostId)
        .eq("user_id", neutralReader.id)
        .select("post_id");
      const owner = await redeClient(neutralReader.client)
        .from("rede_curtidas")
        .delete()
        .eq("post_id", neutralPostId)
        .eq("user_id", neutralReader.id)
        .select("post_id");

      expect(outsider.error).toBeNull();
      expect(outsider.data).toHaveLength(0);
      expect(owner.error).toBeNull();
      expect(owner.data).toEqual([{ post_id: neutralPostId }]);
    });
  });

  it("does not expose the mutual-block helper as a public RPC", async () => {
    const probe = await redeClient(blockerA.client).rpc("rede_bloqueio_mutuo", {
      alvo: blockedAuthor.id,
    });
    expect(probe.error).not.toBeNull();
    expect(["PGRST202", "42883"]).toContain(probe.error?.code);
  });

  it("denies anon and non-members across comments and likes", async () => {
    const anon = redeClient(anonClient());
    for (const result of [
      await anon.from("rede_comentarios").select("id"),
      await anon.from("rede_curtidas").select("post_id"),
    ]) {
      expect(result.error?.code).toBe("42501");
    }

    const comment = await redeClient(nonMember.client)
      .from("rede_comentarios")
      .insert({
        post_id: neutralPostId,
        autor_id: nonMember.id,
        texto: "nao membro",
      });
    const like = await redeClient(nonMember.client)
      .from("rede_curtidas")
      .insert({ post_id: neutralPostId, user_id: nonMember.id });
    expectRlsDenied(comment.error);
    expectRlsDenied(like.error);
  });

  it("keeps service-role access for fixture and server workflows", async () => {
    const service = redeClient(adminClient());
    const posts = await service
      .from("rede_posts")
      .select("id")
      .eq("id", blockedPostId);

    expect(posts.error).toBeNull();
    expect(posts.data).toEqual([{ id: blockedPostId }]);
  });
});
