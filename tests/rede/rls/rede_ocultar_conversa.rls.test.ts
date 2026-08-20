import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Issue #55: excluir conversa esconde só do lado de quem excluiu --
 * `rede_ocultar_conversa` marca `oculta_desde` na própria linha de
 * `rede_conversas_participantes` de quem chama, sem tocar na da outra
 * pessoa nem apagar nenhuma mensagem.
 */

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

describe("RLS: rede_ocultar_conversa", () => {
  const users: TestUser[] = [];
  let userA: TestUser;
  let userB: TestUser;
  let outsider: TestUser;
  let conversationAB: string;

  beforeAll(async () => {
    for (let i = 0; i < 3; i += 1) {
      users.push(await createTestUser());
    }
    [userA, userB, outsider] = users;

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await redeClient(adminClient())
      .from("rede_convites")
      .insert(
        users.map((user) => ({
          codigo_hash: `ocultar-conversa-${user.id}`,
          usado_por: user.id,
          usado_em: now,
          expira_em: expiresAt,
        }))
      );
    if (membershipError) throw membershipError;

    const created = await redeClient(userA.client).rpc(
      "rede_criar_conversa_1a1",
      { outro_user_id: userB.id }
    );
    if (created.error || typeof created.data !== "string") {
      throw new Error(
        `Failed to create conversation: ${created.error?.message}`
      );
    }
    conversationAB = created.data;
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(users.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length) throw new Error("Failed to clean up test users");
  });

  async function ocultaDesde(userId: string): Promise<string | null> {
    const { data, error } = await redeClient(adminClient())
      .from("rede_conversas_participantes")
      .select("oculta_desde")
      .eq("conversa_id", conversationAB)
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return (data as { oculta_desde: string | null }).oculta_desde;
  }

  it("lets A hide the conversation for themself only -- B's row stays untouched", async () => {
    expect(await ocultaDesde(userA.id)).toBeNull();
    expect(await ocultaDesde(userB.id)).toBeNull();

    const { error } = await redeClient(userA.client).rpc(
      "rede_ocultar_conversa",
      { alvo_conversa_id: conversationAB }
    );
    expect(error).toBeNull();

    expect(await ocultaDesde(userA.id)).not.toBeNull();
    expect(await ocultaDesde(userB.id)).toBeNull();
  });

  it("rejects hiding a conversation the caller isn't part of", async () => {
    const { error } = await redeClient(outsider.client).rpc(
      "rede_ocultar_conversa",
      { alvo_conversa_id: conversationAB }
    );
    expect(error).not.toBeNull();
    expect(error?.code).toBe("P0002");
  });

  it("denies anon entirely (no execute grant)", async () => {
    const { error } = await redeClient(anonClient()).rpc(
      "rede_ocultar_conversa",
      { alvo_conversa_id: conversationAB }
    );
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});
