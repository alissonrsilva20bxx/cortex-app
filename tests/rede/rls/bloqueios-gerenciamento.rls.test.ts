import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Adversarial coverage for the new `rede_listar_bloqueados()` RPC (T8, P0
 * unblock UI). Issue #46/0017 made the block relationship fully symmetric
 * on `rede_perfis`/`rede_livelinks` select — correct for general reads, but
 * it also means the blocker can no longer resolve the blocked person's own
 * name through the normal read path, which the "Pessoas bloqueadas" screen
 * needs. This RPC is a narrow, additive exception: security definer,
 * returns only {user_id, nome_exibicao, cor_avatar} (no bio, no
 * LiveLinks), scoped strictly to `bloqueador_id = auth.uid()` — it never
 * reveals who blocked the caller, never lists a third party's blocks, and
 * changes no existing policy (the symmetric protection from 0017 is
 * untouched).
 */

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

type BloqueadoRow = {
  user_id: string;
  nome_exibicao: string;
  cor_avatar: string;
};

async function chamarListarBloqueados(client: SupabaseClient) {
  return client.rpc("rede_listar_bloqueados") as unknown as Promise<{
    data: BloqueadoRow[] | null;
    error: { code?: string; message: string } | null;
  }>;
}

describe("RPC: rede_listar_bloqueados", () => {
  const testUsers: TestUser[] = [];
  let blocker: TestUser;
  let blockedA: TestUser;
  let blockedB: TestUser;
  let outsider: TestUser;
  let bystander: TestUser;

  beforeAll(async () => {
    for (let index = 0; index < 5; index += 1) {
      testUsers.push(await createTestUser());
    }
    [blocker, blockedA, blockedB, outsider, bystander] = testUsers;

    const service = redeClient(adminClient());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await service
      .from("rede_convites")
      .insert(
        testUsers.map((user) => ({
          codigo_hash: `bloqueios-gerenciamento-member-${user.id}`,
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
          bio: "Bio privada que a RPC nunca deve devolver",
        });
      if (error) throw new Error(`Failed to seed profile: ${error.message}`);
    }

    const { error: blockError1 } = await redeClient(blocker.client)
      .from("rede_bloqueios")
      .insert({ bloqueador_id: blocker.id, bloqueado_id: blockedA.id });
    if (blockError1) {
      throw new Error(`Failed to seed block A: ${blockError1.message}`);
    }
    const { error: blockError2 } = await redeClient(blocker.client)
      .from("rede_bloqueios")
      .insert({ bloqueador_id: blocker.id, bloqueado_id: blockedB.id });
    if (blockError2) {
      throw new Error(`Failed to seed block B: ${blockError2.message}`);
    }
    // outsider blocks the blocker, to prove inbound blocks never leak either.
    const { error: blockError3 } = await redeClient(outsider.client)
      .from("rede_bloqueios")
      .insert({ bloqueador_id: outsider.id, bloqueado_id: blocker.id });
    if (blockError3) {
      throw new Error(`Failed to seed block C: ${blockError3.message}`);
    }
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("returns exactly the people the caller blocked, with only id/nome/cor", async () => {
    const { data, error } = await chamarListarBloqueados(
      redeClient(blocker.client)
    );
    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.user_id).sort();
    expect(ids).toEqual([blockedA.id, blockedB.id].sort());

    const row = (data ?? []).find((r) => r.user_id === blockedA.id);
    expect(row?.nome_exibicao).toBe(`Test ${blockedA.id.slice(0, 8)}`);
    expect(row?.cor_avatar).toBe("#123456");
    expect(row && "bio" in row).toBe(false);
  });

  it("never reveals who blocked the caller (asymmetric, unlike the general select policy)", async () => {
    // outsider blocked `blocker` in beforeAll — `blocker` must not see that
    // in their own "who did I block" list, and must not be able to list
    // outsider's blocks either (they have none of their own to hide, this
    // just confirms the RPC only ever reflects the caller's own outgoing
    // blocks).
    const { data, error } = await chamarListarBloqueados(
      redeClient(blocker.client)
    );
    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.user_id);
    expect(ids).not.toContain(outsider.id);
  });

  it("returns an empty list for a user with no blocks (no enumeration of third parties)", async () => {
    const { data, error } = await chamarListarBloqueados(
      redeClient(bystander.client)
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("reflects only the caller's own outgoing block, nothing about the target's other relationships", async () => {
    // outsider blocked `blocker` in beforeAll -- outsider's own list must
    // contain exactly that one outgoing block, and nothing about blocker's
    // separate blocks of blockedA/blockedB.
    const { data, error } = await chamarListarBloqueados(
      redeClient(outsider.client)
    );
    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.user_id)).toEqual([blocker.id]);
  });

  it("returns an empty list for the blocked user (cannot see the blocker's identity or anyone else's block list)", async () => {
    const { data, error } = await chamarListarBloqueados(
      redeClient(blockedA.client)
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects an anonymous caller", async () => {
    const { data, error } = await chamarListarBloqueados(
      redeClient(anonClient())
    );
    expect(data == null || data.length === 0).toBe(true);
    if (error) {
      expect(error.message).toBeTruthy();
    }
  });

  it("stops returning a user once they've been unblocked", async () => {
    const { error: unblockError } = await redeClient(blocker.client)
      .from("rede_bloqueios")
      .delete()
      .eq("bloqueador_id", blocker.id)
      .eq("bloqueado_id", blockedA.id);
    expect(unblockError).toBeNull();

    const { data, error } = await chamarListarBloqueados(
      redeClient(blocker.client)
    );
    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.user_id);
    expect(ids).not.toContain(blockedA.id);
    expect(ids).toContain(blockedB.id);

    // restore the block so the other tests in this file stay independent
    // of execution order.
    const { error: reblockError } = await redeClient(blocker.client)
      .from("rede_bloqueios")
      .insert({ bloqueador_id: blocker.id, bloqueado_id: blockedA.id });
    expect(reblockError).toBeNull();
  });
});
