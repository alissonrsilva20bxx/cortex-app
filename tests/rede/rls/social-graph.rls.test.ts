import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
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

function expectConstraintViolation(
  error: { code?: string } | null,
  code: "23505" | "23514"
): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe(code);
}

describe("RLS: RD-04 social graph", () => {
  const testUsers: TestUser[] = [];
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;
  let userD: TestUser;
  let nonMember: TestUser;
  let friendshipAB: string;
  let friendshipAD: string;
  let blockAB: string;
  let blockAD: string;

  beforeAll(async () => {
    for (let index = 0; index < 5; index += 1) {
      const user = await createTestUser();
      testUsers.push(user);
    }
    [userA, userB, userC, userD, nonMember] = testUsers;

    const service = redeClient(adminClient());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await service
      .from("rede_convites")
      .insert(
        [userA, userB, userC, userD].map((user) => ({
          codigo_hash: `rd04-member-${user.id}`,
          usado_por: user.id,
          usado_em: now,
          expira_em: expiresAt,
        }))
      );
    if (membershipError) {
      throw new Error(
        `Failed to seed Rede memberships: ${membershipError.message}`
      );
    }

    const a = redeClient(userA.client);
    const friendships = await a
      .from("rede_amizades")
      .insert([
        {
          solicitante_id: userA.id,
          destinatario_id: userB.id,
        },
        {
          solicitante_id: userA.id,
          destinatario_id: userD.id,
        },
      ])
      .select("id,destinatario_id");
    if (friendships.error || friendships.data?.length !== 2) {
      throw new Error(
        `Failed to seed friendships as user A: ${friendships.error?.message}`
      );
    }
    const friendshipABRow = friendships.data.find(
      (row) => row.destinatario_id === userB.id
    );
    const friendshipADRow = friendships.data.find(
      (row) => row.destinatario_id === userD.id
    );
    if (!friendshipABRow || !friendshipADRow) {
      throw new Error("Seeded friendships were not returned");
    }
    friendshipAB = friendshipABRow.id;
    friendshipAD = friendshipADRow.id;

    const blocks = await a
      .from("rede_bloqueios")
      .insert([
        { bloqueador_id: userA.id, bloqueado_id: userB.id },
        { bloqueador_id: userA.id, bloqueado_id: userD.id },
      ])
      .select("id,bloqueado_id");
    if (blocks.error || blocks.data?.length !== 2) {
      throw new Error(
        `Failed to seed blocks as user A: ${blocks.error?.message}`
      );
    }
    const blockABRow = blocks.data.find((row) => row.bloqueado_id === userB.id);
    const blockADRow = blocks.data.find((row) => row.bloqueado_id === userD.id);
    if (!blockABRow || !blockADRow) {
      throw new Error("Seeded blocks were not returned");
    }
    blockAB = blockABRow.id;
    blockAD = blockADRow.id;
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  describe("rede_amizades", () => {
    it("lets both endpoints read the friendship and hides it from outsiders", async () => {
      const a = await redeClient(userA.client)
        .from("rede_amizades")
        .select("id")
        .eq("id", friendshipAB);
      const b = await redeClient(userB.client)
        .from("rede_amizades")
        .select("id")
        .eq("id", friendshipAB);
      const c = await redeClient(userC.client)
        .from("rede_amizades")
        .select("id")
        .eq("id", friendshipAB);

      expect(a.error).toBeNull();
      expect(a.data).toEqual([{ id: friendshipAB }]);
      expect(b.error).toBeNull();
      expect(b.data).toEqual([{ id: friendshipAB }]);
      expect(c.error).toBeNull();
      expect(c.data).toHaveLength(0);
    });

    it("lets an endpoint update status and rejects an outsider update", async () => {
      const recipient = await redeClient(userB.client)
        .from("rede_amizades")
        .update({
          status: "aceita",
          respondido_em: new Date().toISOString(),
        })
        .eq("id", friendshipAB)
        .select("status");
      const outsider = await redeClient(userC.client)
        .from("rede_amizades")
        .update({ status: "recusada" })
        .eq("id", friendshipAB)
        .select("id");

      expect(recipient.error).toBeNull();
      expect(recipient.data).toEqual([{ status: "aceita" }]);
      expect(outsider.error).toBeNull();
      expect(outsider.data).toHaveLength(0);
    });

    it("does not let the requester accept their own request", async () => {
      const requester = await redeClient(userA.client)
        .from("rede_amizades")
        .update({
          status: "recusada",
          respondido_em: new Date().toISOString(),
        })
        .eq("id", friendshipAB)
        .select("id");

      expect(requester.error).toBeNull();
      expect(requester.data).toHaveLength(0);
    });

    it("allows exactly one terminal response with a response timestamp", async () => {
      const reanswer = await redeClient(userB.client)
        .from("rede_amizades")
        .update({
          status: "recusada",
          respondido_em: new Date().toISOString(),
        })
        .eq("id", friendshipAB);
      const inconsistentPending = await redeClient(userD.client)
        .from("rede_amizades")
        .update({
          status: "pendente",
          respondido_em: new Date().toISOString(),
        })
        .eq("id", friendshipAD);

      expect(reanswer.error).not.toBeNull();
      expect(inconsistentPending.error).not.toBeNull();
    });

    it("lets an endpoint delete a friendship and hides delete from outsiders", async () => {
      const outsider = await redeClient(userC.client)
        .from("rede_amizades")
        .delete()
        .eq("id", friendshipAD)
        .select("id");
      const endpoint = await redeClient(userD.client)
        .from("rede_amizades")
        .delete()
        .eq("id", friendshipAD)
        .select("id");

      expect(outsider.error).toBeNull();
      expect(outsider.data).toHaveLength(0);
      expect(endpoint.error).toBeNull();
      expect(endpoint.data).toEqual([{ id: friendshipAD }]);
    });

    it("rejects requests forged on behalf of another user", async () => {
      const { error } = await redeClient(userC.client)
        .from("rede_amizades")
        .insert({
          solicitante_id: userA.id,
          destinatario_id: userC.id,
        });

      expectRlsDenied(error);
    });

    it("rejects requests inserted as already accepted", async () => {
      const { error } = await redeClient(userC.client)
        .from("rede_amizades")
        .insert({
          solicitante_id: userC.id,
          destinatario_id: userD.id,
          status: "aceita",
          respondido_em: new Date().toISOString(),
        });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("does not grant endpoint changes to either participant", async () => {
      const recipient = await redeClient(userB.client)
        .from("rede_amizades")
        .update({ destinatario_id: userD.id })
        .eq("id", friendshipAB);
      const requester = await redeClient(userA.client)
        .from("rede_amizades")
        .update({ destinatario_id: userC.id })
        .eq("id", friendshipAB);

      expectPermissionDenied(recipient.error, "rede_amizades");
      expectPermissionDenied(requester.error, "rede_amizades");
    });

    it("rejects the same unordered pair in the opposite direction", async () => {
      const { error } = await redeClient(userB.client)
        .from("rede_amizades")
        .insert({
          solicitante_id: userB.id,
          destinatario_id: userA.id,
        });

      expectConstraintViolation(error, "23505");
    });

    it("rejects friendship with oneself", async () => {
      const { error } = await redeClient(userC.client)
        .from("rede_amizades")
        .insert({
          solicitante_id: userC.id,
          destinatario_id: userC.id,
        });

      expectConstraintViolation(error, "23514");
    });
  });

  describe("rede_bloqueios", () => {
    it("shows a block only to its blocker, not to the blocked user or outsiders", async () => {
      const blocker = await redeClient(userA.client)
        .from("rede_bloqueios")
        .select("id")
        .eq("id", blockAB);
      const blocked = await redeClient(userB.client)
        .from("rede_bloqueios")
        .select("id")
        .eq("id", blockAB);
      const outsider = await redeClient(userC.client)
        .from("rede_bloqueios")
        .select("id")
        .eq("id", blockAB);

      expect(blocker.error).toBeNull();
      expect(blocker.data).toEqual([{ id: blockAB }]);
      expect(blocked.error).toBeNull();
      expect(blocked.data).toHaveLength(0);
      expect(outsider.error).toBeNull();
      expect(outsider.data).toHaveLength(0);
    });

    it("lets only the blocker delete a block", async () => {
      const blocked = await redeClient(userD.client)
        .from("rede_bloqueios")
        .delete()
        .eq("id", blockAD)
        .select("id");
      const blocker = await redeClient(userA.client)
        .from("rede_bloqueios")
        .delete()
        .eq("id", blockAD)
        .select("id");

      expect(blocked.error).toBeNull();
      expect(blocked.data).toHaveLength(0);
      expect(blocker.error).toBeNull();
      expect(blocker.data).toEqual([{ id: blockAD }]);
    });

    it("rejects blocks forged on behalf of another user", async () => {
      const { error } = await redeClient(userC.client)
        .from("rede_bloqueios")
        .insert({
          bloqueador_id: userA.id,
          bloqueado_id: userC.id,
        });

      expectRlsDenied(error);
    });

    it("does not grant any updates on immutable block rows", async () => {
      const { error } = await redeClient(userA.client)
        .from("rede_bloqueios")
        .update({ criado_em: new Date().toISOString() })
        .eq("id", blockAB);

      expectPermissionDenied(error, "rede_bloqueios");
    });

    it("rejects duplicate and self blocks", async () => {
      const duplicate = await redeClient(userA.client)
        .from("rede_bloqueios")
        .insert({ bloqueador_id: userA.id, bloqueado_id: userB.id });
      const self = await redeClient(userC.client)
        .from("rede_bloqueios")
        .insert({ bloqueador_id: userC.id, bloqueado_id: userC.id });

      expectConstraintViolation(duplicate.error, "23505");
      expectConstraintViolation(self.error, "23514");
    });
  });

  it("rejects social graph writes from authenticated non-members", async () => {
    const client = redeClient(nonMember.client);
    const friendship = await client.from("rede_amizades").insert({
      solicitante_id: nonMember.id,
      destinatario_id: userA.id,
    });
    const block = await client.from("rede_bloqueios").insert({
      bloqueador_id: nonMember.id,
      bloqueado_id: userA.id,
    });

    expectRlsDenied(friendship.error);
    expectRlsDenied(block.error);
  });

  it("does not expose social graph tables to anon", async () => {
    const anon = redeClient(anonClient());
    const friendships = await anon.from("rede_amizades").select("id");
    const friendshipInsert = await anon.from("rede_amizades").insert({
      solicitante_id: userC.id,
      destinatario_id: userD.id,
    });
    const friendshipUpdate = await anon
      .from("rede_amizades")
      .update({ status: "aceita" })
      .eq("id", friendshipAB);
    const friendshipDelete = await anon
      .from("rede_amizades")
      .delete()
      .eq("id", friendshipAB);
    const blocks = await anon.from("rede_bloqueios").select("id");
    const blockInsert = await anon.from("rede_bloqueios").insert({
      bloqueador_id: userC.id,
      bloqueado_id: userD.id,
    });
    const blockUpdate = await anon
      .from("rede_bloqueios")
      .update({ criado_em: new Date().toISOString() })
      .eq("id", blockAB);
    const blockDelete = await anon
      .from("rede_bloqueios")
      .delete()
      .eq("id", blockAB);

    expectPermissionDenied(friendships.error, "rede_amizades");
    expectPermissionDenied(friendshipInsert.error, "rede_amizades");
    expectPermissionDenied(friendshipUpdate.error, "rede_amizades");
    expectPermissionDenied(friendshipDelete.error, "rede_amizades");
    expectPermissionDenied(blocks.error, "rede_bloqueios");
    expectPermissionDenied(blockInsert.error, "rede_bloqueios");
    expectPermissionDenied(blockUpdate.error, "rede_bloqueios");
    expectPermissionDenied(blockDelete.error, "rede_bloqueios");
  });

  it("keeps service-role access for fixture and server workflows", async () => {
    const service = redeClient(adminClient());
    const friendships = await service
      .from("rede_amizades")
      .select("id")
      .eq("id", friendshipAB);
    const blocks = await service
      .from("rede_bloqueios")
      .select("id")
      .eq("id", blockAB);

    expect(friendships.error).toBeNull();
    expect(friendships.data).toEqual([{ id: friendshipAB }]);
    expect(blocks.error).toBeNull();
    expect(blocks.data).toEqual([{ id: blockAB }]);
  });
});
