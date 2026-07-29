import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

// RD-09 owns generated database types. Until then, keep the untyped boundary
// inside this test file rather than editing lib/database.types.ts by hand.
function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

function expectPermissionDenied(
  error: { code?: string; message: string } | null,
  table: string
): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
  expect(error?.message).toContain(`permission denied for table ${table}`);
}

describe("RLS: RD-01 beta gating", () => {
  const testUsers: TestUser[] = [];
  const inviteHashes = {
    admin: `rd18-admin-${randomUUID()}`,
    member: `rd18-member-${randomUUID()}`,
    unused: `rd18-unused-${randomUUID()}`,
    forbiddenAuthenticated: `rd18-forbidden-${randomUUID()}`,
    forbiddenAnon: `rd18-anon-forbidden-${randomUUID()}`,
  };

  let adminUser: TestUser;
  let peerAdminUser: TestUser;
  let memberUser: TestUser;
  let outsiderUser: TestUser;

  beforeAll(async () => {
    adminUser = await createTestUser();
    testUsers.push(adminUser);
    peerAdminUser = await createTestUser();
    testUsers.push(peerAdminUser);
    memberUser = await createTestUser();
    testUsers.push(memberUser);
    outsiderUser = await createTestUser();
    testUsers.push(outsiderUser);

    const service = redeClient(adminClient());

    const { error: adminError } = await service
      .from("rede_admins")
      .insert([{ user_id: adminUser.id }, { user_id: peerAdminUser.id }]);
    if (adminError) {
      throw new Error(`Failed to seed Rede admin: ${adminError.message}`);
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const usedAt = new Date().toISOString();
    const { error: inviteError } = await service.from("rede_convites").insert([
      {
        codigo_hash: inviteHashes.admin,
        usado_por: adminUser.id,
        usado_em: usedAt,
        expira_em: expiresAt,
      },
      {
        codigo_hash: inviteHashes.member,
        usado_por: memberUser.id,
        usado_em: usedAt,
        expira_em: expiresAt,
      },
      {
        codigo_hash: inviteHashes.unused,
        expira_em: expiresAt,
      },
    ]);
    if (inviteError) {
      throw new Error(`Failed to seed Rede invites: ${inviteError.message}`);
    }

    const { error: requestError } = await redeClient(memberUser.client)
      .from("rede_solicitacoes_beta")
      .insert({ user_id: memberUser.id });
    if (requestError) {
      throw new Error(
        `Authenticated user could not create own beta request: ${requestError.message}`
      );
    }
  });

  afterAll(async () => {
    const service = redeClient(adminClient());
    const inviteCleanup = await service
      .from("rede_convites")
      .delete()
      .in("codigo_hash", Object.values(inviteHashes));
    const userCleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const userFailures = userCleanup.filter(
      (result) => result.status === "rejected"
    );
    if (inviteCleanup.error || userFailures.length > 0) {
      throw new Error(
        `Failed to clean up local RD-18 fixtures: ${
          inviteCleanup.error?.message ?? `${userFailures.length} user(s)`
        }`
      );
    }
  });

  describe("rede_solicitacoes_beta", () => {
    it("allows authenticated users to read their own pending request", async () => {
      const member = redeClient(memberUser.client);
      const { data, error } = await member
        .from("rede_solicitacoes_beta")
        .select("user_id,status")
        .eq("user_id", memberUser.id)
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        user_id: memberUser.id,
        status: "pendente",
      });
    });

    it("hides another user's request", async () => {
      const outsider = redeClient(outsiderUser.client);
      const { data, error } = await outsider
        .from("rede_solicitacoes_beta")
        .select("user_id")
        .eq("user_id", memberUser.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("rejects inserting a request for another user", async () => {
      const outsider = redeClient(outsiderUser.client);
      const { error } = await outsider.from("rede_solicitacoes_beta").insert({
        user_id: adminUser.id,
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("rejects a privileged initial status", async () => {
      const outsider = redeClient(outsiderUser.client);
      const { error } = await outsider.from("rede_solicitacoes_beta").insert({
        user_id: outsiderUser.id,
        status: "convidado",
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("does not grant update or delete to authenticated users", async () => {
      const member = redeClient(memberUser.client);
      const update = await member
        .from("rede_solicitacoes_beta")
        .update({ status: "convidado" })
        .eq("user_id", memberUser.id);
      const removal = await member
        .from("rede_solicitacoes_beta")
        .delete()
        .eq("user_id", memberUser.id);

      expectPermissionDenied(update.error, "rede_solicitacoes_beta");
      expectPermissionDenied(removal.error, "rede_solicitacoes_beta");
    });
  });

  describe("rede_admins", () => {
    it("lets each admin read only their own allowlist row", async () => {
      const admin = redeClient(adminUser.client);
      const peerAdmin = redeClient(peerAdminUser.client);
      const own = await admin.from("rede_admins").select("user_id");
      const peerOwn = await peerAdmin.from("rede_admins").select("user_id");

      expect(own.error).toBeNull();
      expect(own.data).toEqual([{ user_id: adminUser.id }]);
      expect(peerOwn.error).toBeNull();
      expect(peerOwn.data).toEqual([{ user_id: peerAdminUser.id }]);
    });

    it("does not reveal the admin allowlist to a non-admin", async () => {
      const member = redeClient(memberUser.client);
      const { data, error } = await member
        .from("rede_admins")
        .select("user_id");

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("does not grant allowlist writes to authenticated users", async () => {
      const member = redeClient(memberUser.client);
      const insertion = await member
        .from("rede_admins")
        .insert({ user_id: memberUser.id });
      const removal = await redeClient(adminUser.client)
        .from("rede_admins")
        .delete()
        .eq("user_id", adminUser.id);
      const update = await redeClient(adminUser.client)
        .from("rede_admins")
        .update({ criado_em: new Date().toISOString() })
        .eq("user_id", adminUser.id);

      expectPermissionDenied(insertion.error, "rede_admins");
      expectPermissionDenied(removal.error, "rede_admins");
      expectPermissionDenied(update.error, "rede_admins");
    });
  });

  describe("rede_convites", () => {
    it("allows an admin to read every invite", async () => {
      const admin = redeClient(adminUser.client);
      const { data, error } = await admin
        .from("rede_convites")
        .select("codigo_hash")
        .in("codigo_hash", Object.values(inviteHashes));

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
    });

    it("lets a non-admin read only their redeemed invite", async () => {
      const member = redeClient(memberUser.client);
      const { data, error } = await member
        .from("rede_convites")
        .select("codigo_hash")
        .in("codigo_hash", Object.values(inviteHashes));

      expect(error).toBeNull();
      expect(data).toEqual([{ codigo_hash: inviteHashes.member }]);
    });

    it("hides all invites from an authenticated outsider", async () => {
      const outsider = redeClient(outsiderUser.client);
      const { data, error } = await outsider
        .from("rede_convites")
        .select("codigo_hash")
        .in("codigo_hash", Object.values(inviteHashes));

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("does not grant invite writes to authenticated users", async () => {
      const member = redeClient(memberUser.client);
      const insertion = await member.from("rede_convites").insert({
        codigo_hash: inviteHashes.forbiddenAuthenticated,
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      const update = await member
        .from("rede_convites")
        .update({ usado_em: new Date().toISOString() })
        .eq("codigo_hash", inviteHashes.member);
      const removal = await member
        .from("rede_convites")
        .delete()
        .eq("codigo_hash", inviteHashes.member);

      expectPermissionDenied(insertion.error, "rede_convites");
      expectPermissionDenied(update.error, "rede_convites");
      expectPermissionDenied(removal.error, "rede_convites");
    });
  });

  it("does not grant any RD-01 table privileges or admin helper execution to anon", async () => {
    const anon = redeClient(anonClient());
    const requests = await anon.from("rede_solicitacoes_beta").select("id");
    const requestInsert = await anon
      .from("rede_solicitacoes_beta")
      .insert({ user_id: outsiderUser.id });
    const requestUpdate = await anon
      .from("rede_solicitacoes_beta")
      .update({ status: "convidado" })
      .eq("user_id", memberUser.id);
    const requestDelete = await anon
      .from("rede_solicitacoes_beta")
      .delete()
      .eq("user_id", memberUser.id);

    const admins = await anon.from("rede_admins").select("user_id");
    const adminInsert = await anon
      .from("rede_admins")
      .insert({ user_id: outsiderUser.id });
    const adminUpdate = await anon
      .from("rede_admins")
      .update({ criado_em: new Date().toISOString() })
      .eq("user_id", adminUser.id);
    const adminDelete = await anon
      .from("rede_admins")
      .delete()
      .eq("user_id", adminUser.id);

    const invites = await anon.from("rede_convites").select("id");
    const inviteInsert = await anon.from("rede_convites").insert({
      codigo_hash: inviteHashes.forbiddenAnon,
      expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const inviteUpdate = await anon
      .from("rede_convites")
      .update({ usado_em: new Date().toISOString() })
      .eq("codigo_hash", inviteHashes.member);
    const inviteDelete = await anon
      .from("rede_convites")
      .delete()
      .eq("codigo_hash", inviteHashes.member);

    const helper = await anon.rpc("rede_is_admin");

    expectPermissionDenied(requests.error, "rede_solicitacoes_beta");
    expectPermissionDenied(requestInsert.error, "rede_solicitacoes_beta");
    expectPermissionDenied(requestUpdate.error, "rede_solicitacoes_beta");
    expectPermissionDenied(requestDelete.error, "rede_solicitacoes_beta");
    expectPermissionDenied(admins.error, "rede_admins");
    expectPermissionDenied(adminInsert.error, "rede_admins");
    expectPermissionDenied(adminUpdate.error, "rede_admins");
    expectPermissionDenied(adminDelete.error, "rede_admins");
    expectPermissionDenied(invites.error, "rede_convites");
    expectPermissionDenied(inviteInsert.error, "rede_convites");
    expectPermissionDenied(inviteUpdate.error, "rede_convites");
    expectPermissionDenied(inviteDelete.error, "rede_convites");
    expect(helper.error).not.toBeNull();
    expect(helper.error?.code).toBe("42501");
  });
});
