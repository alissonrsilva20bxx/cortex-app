import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Proves the harness end-to-end (RD-17's acceptance criterion): create 2+
 * test users, authenticate as each, and run an RLS assertion against a
 * non-production environment.
 *
 * No Rede tables exist yet (they land in RD-01+), so this exercises the
 * `jobs` table's existing "owner full access" policy (supabase/migrations/
 * 0001_jobapp_schema.sql) — the same row-level-security pattern every Rede
 * table will use. RD-18 adds the equivalent suite per Rede table as each
 * migration lands.
 */
describe("RLS: jobs (owner full access)", () => {
  const testUsers: TestUser[] = [];
  let userA: TestUser;
  let userB: TestUser;
  let jobId: string;

  beforeAll(async () => {
    userA = await createTestUser();
    testUsers.push(userA);
    userB = await createTestUser();
    testUsers.push(userB);

    const { data, error } = await userA.client
      .from("jobs")
      .insert({
        user_id: userA.id,
        cliente_nome: "Cliente de teste",
        data: "2026-08-01",
        hora: "10:00:00",
        valor: 100,
        modalidade: "online",
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Failed to seed job as user A: ${error?.message}`);
    }
    jobId = data.id;
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

  it("lets the owner read their own job", async () => {
    const { data, error } = await userA.client
      .from("jobs")
      .select("id")
      .eq("id", jobId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toBe(jobId);
  });

  it("hides the job from a different authenticated user", async () => {
    const { data, error } = await userB.client
      .from("jobs")
      .select("id")
      .eq("id", jobId);

    // RLS filters the row out rather than erroring — this must return an
    // empty result, not the other user's job.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("rejects a different user trying to update the job", async () => {
    const { data, error } = await userB.client
      .from("jobs")
      .update({ cliente_nome: "Hijacked" })
      .eq("id", jobId)
      .select("id");

    expect(error).toBeNull();
    // Blocked by the RLS USING clause: zero rows match, so zero rows update.
    expect(data).toHaveLength(0);
  });
});
