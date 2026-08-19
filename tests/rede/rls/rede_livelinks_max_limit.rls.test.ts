import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Issue #61: `components/rede/LiveLinksSection.tsx` enforces
 * `LIVELINKS_MAX = 5` only in the client -- nothing in
 * `supabase/migrations/**` stopped a direct API/RPC insert from creating a
 * 6th row for the same user. Migration 0019 adds a `BEFORE INSERT` trigger
 * (`rede_livelinks_max_limit_check`) that counts the owner's existing rows
 * and rejects the insert past 5, with the same errcode ('23514') other
 * business-rule triggers in this schema use for invalid transitions.
 */

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

function expectLimitExceeded(error: { code?: string } | null): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("23514");
}

describe("RLS: rede_livelinks max-5-per-user is enforced in the database", () => {
  const testUsers: TestUser[] = [];
  let owner: TestUser;

  beforeAll(async () => {
    owner = await createTestUser();
    testUsers.push(owner);

    const service = redeClient(adminClient());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await service
      .from("rede_convites")
      .insert({
        codigo_hash: `livelinks-max-limit-${owner.id}`,
        usado_por: owner.id,
        usado_em: now,
        expira_em: expiresAt,
      });
    if (membershipError) {
      throw new Error(`Failed to seed membership: ${membershipError.message}`);
    }

    const { error: profileError } = await redeClient(owner.client)
      .from("rede_perfis")
      .insert({
        user_id: owner.id,
        nome_exibicao: `Max limit ${owner.id.slice(0, 8)}`,
        cor_avatar: "#123456",
      });
    if (profileError) {
      throw new Error(`Failed to seed profile: ${profileError.message}`);
    }
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("allows the 5th LiveLink and rejects a 6th, then allows a new insert once back under 5", async () => {
    for (let ordem = 0; ordem < 5; ordem += 1) {
      const { error } = await redeClient(owner.client)
        .from("rede_livelinks")
        .insert({
          user_id: owner.id,
          titulo: `Link ${ordem}`,
          url: "https://example.test",
          ordem,
        });
      expect(error).toBeNull();
    }

    const sixthInsert = await redeClient(owner.client)
      .from("rede_livelinks")
      .insert({
        user_id: owner.id,
        titulo: "Link 5",
        url: "https://example.test",
        ordem: 5,
      });
    expectLimitExceeded(sixthInsert.error);

    const { data: existing, error: listError } = await redeClient(owner.client)
      .from("rede_livelinks")
      .select("id")
      .eq("user_id", owner.id)
      .limit(1);
    expect(listError).toBeNull();
    expect(existing).toHaveLength(1);

    const { error: deleteError } = await redeClient(owner.client)
      .from("rede_livelinks")
      .delete()
      .eq("id", existing![0].id);
    expect(deleteError).toBeNull();

    const backUnderLimit = await redeClient(owner.client)
      .from("rede_livelinks")
      .insert({
        user_id: owner.id,
        titulo: "Link novo",
        url: "https://example.test",
        ordem: 6,
      });
    expect(backUnderLimit.error).toBeNull();
  });
});
