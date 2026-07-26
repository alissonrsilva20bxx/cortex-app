import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * rede_amizades/rede_bloqueios postdate the last `lib/database.types.ts`
 * generation (RD-09, gated on every MVP migration landing), so this file
 * talks to them through an untyped view of the same client, same as
 * rede_perfis.rls.test.ts.
 */
function untyped(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

/**
 * RD-04 acceptance criteria, proven end-to-end against a local Supabase:
 * a duplicate friend request (in either direction) is rejected by the
 * unordered-pair unique index, and a user only sees rede_amizades/
 * rede_bloqueios rows where they appear as one of the two ends.
 */
describe("RLS: rede_amizades + rede_bloqueios", () => {
  const testUsers: TestUser[] = [];
  let memberA: TestUser;
  let memberB: TestUser;
  let memberC: TestUser;

  /** rede_amizades/rede_bloqueios FK to rede_perfis(user_id), so every test user needs a profile. */
  async function createProfileFor(userId: string, nome: string): Promise<void> {
    const { error } = await untyped(adminClient())
      .from("rede_perfis")
      .insert({ user_id: userId, nome_exibicao: nome, cor_avatar: "#123456" });
    if (error) {
      throw new Error(`Failed to seed profile: ${error.message}`);
    }
  }

  beforeAll(async () => {
    memberA = await createTestUser();
    testUsers.push(memberA);
    memberB = await createTestUser();
    testUsers.push(memberB);
    memberC = await createTestUser();
    testUsers.push(memberC);

    await createProfileFor(memberA.id, "Membro A");
    await createProfileFor(memberB.id, "Membro B");
    await createProfileFor(memberC.id, "Membro C");
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

  describe("rede_amizades", () => {
    it("lets a member send a friend request to another member", async () => {
      const { data, error } = await untyped(memberA.client)
        .from("rede_amizades")
        .insert({ solicitante_id: memberA.id, destinatario_id: memberB.id })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
    });

    it("rejects a duplicate request in the same direction", async () => {
      const { error } = await untyped(memberA.client)
        .from("rede_amizades")
        .insert({ solicitante_id: memberA.id, destinatario_id: memberB.id });

      expect(error).not.toBeNull();
    });

    it("rejects a duplicate request in the reverse direction", async () => {
      const { error } = await untyped(memberB.client)
        .from("rede_amizades")
        .insert({ solicitante_id: memberB.id, destinatario_id: memberA.id });

      expect(error).not.toBeNull();
    });

    it("rejects a self-friend request", async () => {
      const { error } = await untyped(memberC.client)
        .from("rede_amizades")
        .insert({ solicitante_id: memberC.id, destinatario_id: memberC.id });

      expect(error).not.toBeNull();
    });

    it("rejects impersonating another user as the requester", async () => {
      const { error } = await untyped(memberC.client)
        .from("rede_amizades")
        .insert({ solicitante_id: memberA.id, destinatario_id: memberC.id });

      expect(error).not.toBeNull();
    });

    it("lets the recipient see the pending request", async () => {
      const { data, error } = await untyped(memberB.client)
        .from("rede_amizades")
        .select("id, status")
        .eq("solicitante_id", memberA.id)
        .eq("destinatario_id", memberB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].status).toBe("pendente");
    });

    it("hides the request from a user who isn't a participant", async () => {
      const { data, error } = await untyped(memberC.client)
        .from("rede_amizades")
        .select("id")
        .eq("solicitante_id", memberA.id)
        .eq("destinatario_id", memberB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("lets a participant (recipient) update the status to accepted", async () => {
      const { data, error } = await untyped(memberB.client)
        .from("rede_amizades")
        .update({ status: "aceita", respondido_em: new Date().toISOString() })
        .eq("solicitante_id", memberA.id)
        .eq("destinatario_id", memberB.id)
        .select("status");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].status).toBe("aceita");
    });

    it("rejects a non-participant trying to update the friendship", async () => {
      const { data, error } = await untyped(memberC.client)
        .from("rede_amizades")
        .update({ status: "recusada" })
        .eq("solicitante_id", memberA.id)
        .eq("destinatario_id", memberB.id)
        .select("id");

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("rejects a non-participant trying to delete the friendship", async () => {
      const { data, error } = await untyped(memberC.client)
        .from("rede_amizades")
        .delete()
        .eq("solicitante_id", memberA.id)
        .eq("destinatario_id", memberB.id)
        .select("id");

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("lets a participant delete the friendship", async () => {
      const { data, error } = await untyped(memberA.client)
        .from("rede_amizades")
        .delete()
        .eq("solicitante_id", memberA.id)
        .eq("destinatario_id", memberB.id)
        .select("id");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("allows a new request for the same pair once the previous row is gone", async () => {
      const { error } = await untyped(memberA.client)
        .from("rede_amizades")
        .insert({ solicitante_id: memberA.id, destinatario_id: memberB.id });

      expect(error).toBeNull();
    });
  });

  describe("rede_bloqueios", () => {
    it("lets a member block another member", async () => {
      const { data, error } = await untyped(memberA.client)
        .from("rede_bloqueios")
        .insert({ bloqueador_id: memberA.id, bloqueado_id: memberC.id })
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeTruthy();
    });

    it("rejects a duplicate block of the same pair", async () => {
      const { error } = await untyped(memberA.client)
        .from("rede_bloqueios")
        .insert({ bloqueador_id: memberA.id, bloqueado_id: memberC.id });

      expect(error).not.toBeNull();
    });

    it("rejects a self-block", async () => {
      const { error } = await untyped(memberB.client)
        .from("rede_bloqueios")
        .insert({ bloqueador_id: memberB.id, bloqueado_id: memberB.id });

      expect(error).not.toBeNull();
    });

    it("rejects impersonating another user as the blocker", async () => {
      const { error } = await untyped(memberB.client)
        .from("rede_bloqueios")
        .insert({ bloqueador_id: memberA.id, bloqueado_id: memberB.id });

      expect(error).not.toBeNull();
    });

    it("lets the blocker see their own block", async () => {
      const { data, error } = await untyped(memberA.client)
        .from("rede_bloqueios")
        .select("id")
        .eq("bloqueador_id", memberA.id)
        .eq("bloqueado_id", memberC.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("hides the block from the blocked user (blocked party can't discover it)", async () => {
      const { data, error } = await untyped(memberC.client)
        .from("rede_bloqueios")
        .select("id")
        .eq("bloqueador_id", memberA.id)
        .eq("bloqueado_id", memberC.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("hides the block from an unrelated member", async () => {
      const { data, error } = await untyped(memberB.client)
        .from("rede_bloqueios")
        .select("id")
        .eq("bloqueador_id", memberA.id)
        .eq("bloqueado_id", memberC.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("lets the blocker remove their own block", async () => {
      const { data, error } = await untyped(memberA.client)
        .from("rede_bloqueios")
        .delete()
        .eq("bloqueador_id", memberA.id)
        .eq("bloqueado_id", memberC.id)
        .select("id");

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });
});
