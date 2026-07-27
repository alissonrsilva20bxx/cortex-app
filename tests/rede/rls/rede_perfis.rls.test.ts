import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * rede_perfis/rede_livelinks/rede_convites postdate the last `lib/database.types.ts`
 * generation (that regeneration is RD-09, gated on every MVP migration landing).
 * Calling them through the generated `Database` type doesn't typecheck yet, so this
 * file talks to them through an untyped view of the same client.
 */
function untyped(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

/**
 * RD-02 acceptance criteria, proven end-to-end against a local Supabase:
 * a user without a redeemed invite cannot create a rede_perfis row, a user
 * with a redeemed invite can, and any member can SELECT another member's
 * profile. Also covers rede_livelinks, which shares the same membership
 * gate (see docs/rede/SUPABASE_MIGRATION_PLAN.md §2).
 */
describe("RLS: rede_perfis + rede_livelinks", () => {
  const testUsers: TestUser[] = [];
  let memberA: TestUser;
  let memberB: TestUser;
  let outsider: TestUser;

  /** Simulates a redeemed invite by writing rede_convites as service role. */
  async function redeemInviteFor(userId: string): Promise<void> {
    const { error } = await untyped(adminClient())
      .from("rede_convites")
      .insert({
        codigo_hash: randomUUID(),
        usado_por: userId,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 86_400_000).toISOString(),
      });
    if (error) {
      throw new Error(`Failed to seed redeemed invite: ${error.message}`);
    }
  }

  async function revokeInviteFor(userId: string): Promise<void> {
    const { error } = await untyped(adminClient())
      .from("rede_convites")
      .delete()
      .eq("usado_por", userId);
    if (error) {
      throw new Error(`Failed to revoke redeemed invite: ${error.message}`);
    }
  }

  beforeAll(async () => {
    memberA = await createTestUser();
    testUsers.push(memberA);
    memberB = await createTestUser();
    testUsers.push(memberB);
    outsider = await createTestUser();
    testUsers.push(outsider);

    await redeemInviteFor(memberA.id);
    await redeemInviteFor(memberB.id);
    // outsider never redeems an invite.
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

  it("rejects a profile insert from a user without a redeemed invite", async () => {
    const { error } = await untyped(outsider.client)
      .from("rede_perfis")
      .insert({
        user_id: outsider.id,
        nome_exibicao: "Outsider",
        cor_avatar: "#123456",
      });

    expect(error).not.toBeNull();
  });

  it("lets a user with a redeemed invite create their profile", async () => {
    const { data, error } = await untyped(memberA.client)
      .from("rede_perfis")
      .insert({
        user_id: memberA.id,
        nome_exibicao: "Membro A",
        cor_avatar: "#123456",
      })
      .select("user_id")
      .single();

    expect(error).toBeNull();
    expect(data?.user_id).toBe(memberA.id);
  });

  it("lets the owner update and delete their own profile", async () => {
    const inserted = await untyped(memberB.client).from("rede_perfis").insert({
      user_id: memberB.id,
      nome_exibicao: "Membro B",
      cor_avatar: "#654321",
    });
    expect(inserted.error).toBeNull();

    const updated = await untyped(memberB.client)
      .from("rede_perfis")
      .update({ nome_exibicao: "Membro B atualizado" })
      .eq("user_id", memberB.id)
      .select("nome_exibicao");
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual([{ nome_exibicao: "Membro B atualizado" }]);

    const removed = await untyped(memberB.client)
      .from("rede_perfis")
      .delete()
      .eq("user_id", memberB.id)
      .select("user_id");
    expect(removed.error).toBeNull();
    expect(removed.data).toEqual([{ user_id: memberB.id }]);
  });

  it("lets any member SELECT another member's profile", async () => {
    const { data, error } = await untyped(memberB.client)
      .from("rede_perfis")
      .select("user_id, nome_exibicao")
      .eq("user_id", memberA.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].nome_exibicao).toBe("Membro A");
  });

  it("hides a profile from a user without a redeemed invite", async () => {
    const { data, error } = await untyped(outsider.client)
      .from("rede_perfis")
      .select("user_id")
      .eq("user_id", memberA.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("does not expose the membership helper to an anonymous caller", async () => {
    const { error } = await untyped(anonClient()).rpc("rede_is_member");

    expect(error).not.toBeNull();
  });

  it("does not let an authenticated outsider bypass the membership helper", async () => {
    const { data, error } = await untyped(outsider.client).rpc(
      "rede_is_member"
    );

    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("rejects a different member trying to update the profile", async () => {
    const { data, error } = await untyped(memberB.client)
      .from("rede_perfis")
      .update({ nome_exibicao: "Hijacked" })
      .eq("user_id", memberA.id)
      .select("user_id");

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("rejects deleting a profile after its redeemed invite is revoked", async () => {
    await revokeInviteFor(memberA.id);
    try {
      const { data, error } = await untyped(memberA.client)
        .from("rede_perfis")
        .delete()
        .eq("user_id", memberA.id)
        .select("user_id");

      expect(error).toBeNull();
      expect(data).toHaveLength(0);

      const { data: persistedProfile, error: verificationError } =
        await untyped(adminClient())
          .from("rede_perfis")
          .select("user_id")
          .eq("user_id", memberA.id)
          .single();

      expect(verificationError).toBeNull();
      expect(persistedProfile?.user_id).toBe(memberA.id);
    } finally {
      await redeemInviteFor(memberA.id);
    }
  });

  describe("rede_livelinks", () => {
    let livelinkId: string;

    it("lets the profile owner create a LiveLink", async () => {
      const { data, error } = await untyped(memberA.client)
        .from("rede_livelinks")
        .insert({
          user_id: memberA.id,
          titulo: "Portfolio",
          url: "https://example.test/portfolio",
          ordem: 0,
        })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
      livelinkId = data!.id;
    });

    it("lets another member SELECT that LiveLink", async () => {
      const { data, error } = await untyped(memberB.client)
        .from("rede_livelinks")
        .select("id, titulo")
        .eq("id", livelinkId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].titulo).toBe("Portfolio");
    });

    it("rejects a non-member trying to SELECT the LiveLink", async () => {
      const { data, error } = await untyped(outsider.client)
        .from("rede_livelinks")
        .select("id")
        .eq("id", livelinkId);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("rejects a different member trying to update someone else's LiveLink", async () => {
      const { data, error } = await untyped(memberB.client)
        .from("rede_livelinks")
        .update({ titulo: "Hijacked" })
        .eq("id", livelinkId)
        .select("id");

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("rejects creating a LiveLink for another member", async () => {
      const { error } = await untyped(memberB.client)
        .from("rede_livelinks")
        .insert({
          user_id: memberA.id,
          titulo: "Forjado",
          url: "https://example.test/forjado",
          ordem: 1,
        });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("lets only the owner update and delete their LiveLink", async () => {
      const outsiderDelete = await untyped(memberB.client)
        .from("rede_livelinks")
        .delete()
        .eq("id", livelinkId)
        .select("id");
      expect(outsiderDelete.error).toBeNull();
      expect(outsiderDelete.data).toHaveLength(0);

      const ownerUpdate = await untyped(memberA.client)
        .from("rede_livelinks")
        .update({ titulo: "Portfolio atualizado" })
        .eq("id", livelinkId)
        .select("titulo");
      expect(ownerUpdate.error).toBeNull();
      expect(ownerUpdate.data).toEqual([{ titulo: "Portfolio atualizado" }]);

      const ownerDelete = await untyped(memberA.client)
        .from("rede_livelinks")
        .delete()
        .eq("id", livelinkId)
        .select("id");
      expect(ownerDelete.error).toBeNull();
      expect(ownerDelete.data).toEqual([{ id: livelinkId }]);
    });
  });
});
