import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Adversarial coverage for a P0 access-control gap: `rede_perfis`/
 * `rede_livelinks` select and `rede_amizades` insert policies did not
 * account for the block relationship between the two users involved, so
 * a blocked pair could still read each other's full profile/LiveLinks
 * and still write a new pending friend request against each other.
 * Fixed by reusing the same block-aware helper
 * (`private.rede_users_unblocked`) already used correctly for posts
 * (0009) and conversations (0010) — this migration retrofits it to the
 * two policies that were missing it.
 */

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

function expectRlsDenied(error: { code?: string } | null): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
}

describe("RLS: block relationship excludes rede_perfis/rede_livelinks read and rede_amizades insert", () => {
  const testUsers: TestUser[] = [];
  let blocker: TestUser;
  let blocked: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    for (let index = 0; index < 3; index += 1) {
      testUsers.push(await createTestUser());
    }
    [blocker, blocked, outsider] = testUsers;

    const service = redeClient(adminClient());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await service
      .from("rede_convites")
      .insert(
        testUsers.map((user) => ({
          codigo_hash: `bloqueios-rls-member-${user.id}`,
          usado_por: user.id,
          usado_em: now,
          expira_em: expiresAt,
        }))
      );
    if (membershipError) {
      throw new Error(`Failed to seed memberships: ${membershipError.message}`);
    }

    for (const user of testUsers) {
      const { error } = await redeClient(user.client)
        .from("rede_perfis")
        .insert({
          user_id: user.id,
          nome_exibicao: `Test ${user.id.slice(0, 8)}`,
          cor_avatar: "#123456",
        });
      if (error) throw new Error(`Failed to seed profile: ${error.message}`);

      const { error: linkError } = await redeClient(user.client)
        .from("rede_livelinks")
        .insert({
          user_id: user.id,
          titulo: "Site",
          url: "https://example.test",
        });
      if (linkError) {
        throw new Error(`Failed to seed livelink: ${linkError.message}`);
      }
    }

    const { error: blockError } = await redeClient(blocker.client)
      .from("rede_bloqueios")
      .insert({ bloqueador_id: blocker.id, bloqueado_id: blocked.id });
    if (blockError) {
      throw new Error(`Failed to seed block: ${blockError.message}`);
    }
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  describe("rede_perfis: member select", () => {
    it("hides the blocker's profile from the blocked user", async () => {
      const { data, error } = await redeClient(blocked.client)
        .from("rede_perfis")
        .select("user_id")
        .eq("user_id", blocker.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("hides the blocked user's profile from the blocker (symmetric)", async () => {
      const { data, error } = await redeClient(blocker.client)
        .from("rede_perfis")
        .select("user_id")
        .eq("user_id", blocked.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("still lets an unrelated member read either profile (no over-restriction)", async () => {
      const readsBlocker = await redeClient(outsider.client)
        .from("rede_perfis")
        .select("user_id")
        .eq("user_id", blocker.id);
      const readsBlocked = await redeClient(outsider.client)
        .from("rede_perfis")
        .select("user_id")
        .eq("user_id", blocked.id);

      expect(readsBlocker.data).toEqual([{ user_id: blocker.id }]);
      expect(readsBlocked.data).toEqual([{ user_id: blocked.id }]);
    });

    it("still lets each user read their own profile despite having a block on record", async () => {
      const ownProfile = await redeClient(blocker.client)
        .from("rede_perfis")
        .select("user_id")
        .eq("user_id", blocker.id);

      expect(ownProfile.data).toEqual([{ user_id: blocker.id }]);
    });
  });

  describe("rede_livelinks: member select", () => {
    it("hides the blocker's LiveLinks from the blocked user", async () => {
      const { data, error } = await redeClient(blocked.client)
        .from("rede_livelinks")
        .select("user_id")
        .eq("user_id", blocker.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("hides the blocked user's LiveLinks from the blocker (symmetric)", async () => {
      const { data, error } = await redeClient(blocker.client)
        .from("rede_livelinks")
        .select("user_id")
        .eq("user_id", blocked.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("still lets an unrelated member read either LiveLinks list", async () => {
      const readsBlocker = await redeClient(outsider.client)
        .from("rede_livelinks")
        .select("user_id")
        .eq("user_id", blocker.id);

      expect(readsBlocker.data).toEqual([{ user_id: blocker.id }]);
    });
  });

  describe("rede_amizades: requester insert", () => {
    it("rejects a friend request from the blocked user to the blocker", async () => {
      const { error } = await redeClient(blocked.client)
        .from("rede_amizades")
        .insert({ solicitante_id: blocked.id, destinatario_id: blocker.id });

      expectRlsDenied(error);
    });

    it("rejects a friend request from the blocker to the blocked user (symmetric)", async () => {
      const { error } = await redeClient(blocker.client)
        .from("rede_amizades")
        .insert({ solicitante_id: blocker.id, destinatario_id: blocked.id });

      expectRlsDenied(error);
    });

    it("still allows a friend request between users with no block relationship", async () => {
      const { error, data } = await redeClient(outsider.client)
        .from("rede_amizades")
        .insert({ solicitante_id: outsider.id, destinatario_id: blocker.id })
        .select("id");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      // cleanup so this test stays independent of insertion order/reruns
      await redeClient(adminClient())
        .from("rede_amizades")
        .delete()
        .eq("id", data![0].id);
    });
  });
});
