import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * rede_assinaturas postdates the last `lib/database.types.ts` generation
 * (that regeneration is RD-09, gated on every MVP migration landing).
 * Calling it through the generated `Database` type doesn't typecheck yet,
 * so this file talks to it through an untyped view of the same client.
 */
function untyped(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

/**
 * RD-03 acceptance criteria, proven end-to-end against a local Supabase:
 * an authenticated client can read its own subscription row, but cannot
 * self-activate, self-renew, or otherwise write to rede_assinaturas in any
 * way -- that requires service_role. This is the fix for the critical
 * blocker Codex flagged in docs/rede/CODEX_REVIEW.md: rede_assinaturas
 * controls paid access, so owner-writable RLS would let any authenticated
 * user grant themselves an active subscription.
 */
describe("RLS: rede_assinaturas", () => {
  const testUsers: TestUser[] = [];
  let owner: TestUser;
  let outsider: TestUser;

  async function seedTrialFor(userId: string): Promise<void> {
    const { error } = await untyped(adminClient())
      .from("rede_assinaturas")
      .insert({ user_id: userId });
    if (error) {
      throw new Error(`Failed to seed rede_assinaturas row: ${error.message}`);
    }
  }

  beforeAll(async () => {
    owner = await createTestUser();
    testUsers.push(owner);
    outsider = await createTestUser();
    testUsers.push(outsider);

    await seedTrialFor(owner.id);
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

  it("lets the owner read their own subscription row", async () => {
    const { data, error } = await untyped(owner.client)
      .from("rede_assinaturas")
      .select("user_id, status, trial_started_at")
      .eq("user_id", owner.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].status).toBe("trial");
  });

  it("hides another user's subscription row (RLS filters, no error)", async () => {
    const { data, error } = await untyped(outsider.client)
      .from("rede_assinaturas")
      .select("user_id")
      .eq("user_id", owner.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("blocks the owner from inserting their own row (no self-signup)", async () => {
    const { error } = await untyped(outsider.client)
      .from("rede_assinaturas")
      .insert({ user_id: outsider.id });

    expect(error).not.toBeNull();
  });

  it("blocks the owner from self-activating an existing row", async () => {
    const { error, data } = await untyped(owner.client)
      .from("rede_assinaturas")
      .update({ status: "ativa" })
      .eq("user_id", owner.id)
      .select("user_id");

    // No INSERT/UPDATE/DELETE grant at all for `authenticated` -- Postgres
    // rejects the statement at the privilege-check stage, before RLS is
    // even evaluated. This is the double-layer defense from the migration
    // header: table GRANT + absence of a write policy, either one alone
    // would already be enough to block this.
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("blocks the owner from resetting their own trial_started_at", async () => {
    const { error } = await untyped(owner.client)
      .from("rede_assinaturas")
      .update({ trial_started_at: new Date().toISOString() })
      .eq("user_id", owner.id);

    expect(error).not.toBeNull();
  });

  it("blocks the owner from deleting their own row", async () => {
    const { error } = await untyped(owner.client)
      .from("rede_assinaturas")
      .delete()
      .eq("user_id", owner.id);

    expect(error).not.toBeNull();
  });

  it("still lets service_role manage the row (privileged path is intact)", async () => {
    const updated = await untyped(adminClient())
      .from("rede_assinaturas")
      .update({ status: "ativa" })
      .eq("user_id", owner.id)
      .select("status")
      .single();

    expect(updated.error).toBeNull();
    expect(updated.data?.status).toBe("ativa");

    // Restore trial state so this test is order-independent / re-runnable.
    const reverted = await untyped(adminClient())
      .from("rede_assinaturas")
      .update({ status: "trial" })
      .eq("user_id", owner.id);
    expect(reverted.error).toBeNull();
  });
});
