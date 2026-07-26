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

describe("RLS: RD-06 messaging", () => {
  const users: TestUser[] = [];
  let userA: TestUser;
  let userB: TestUser;
  let outsider: TestUser;
  let nonMember: TestUser;
  let conversationAB: string;
  let messageAB: string;

  beforeAll(async () => {
    for (let index = 0; index < 4; index += 1) {
      users.push(await createTestUser());
    }
    [userA, userB, outsider, nonMember] = users;

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await redeClient(adminClient())
      .from("rede_convites")
      .insert(
        [userA, userB, outsider].map((user) => ({
          codigo_hash: `rd06-member-${user.id}`,
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
    if (failures.length) throw new Error("Failed to clean RD-06 users");
  });

  it("creates one canonical 1:1 conversation regardless of endpoint order", async () => {
    const same = await redeClient(userB.client).rpc("rede_criar_conversa_1a1", {
      outro_user_id: userA.id,
    });
    expect(same.error).toBeNull();
    expect(same.data).toBe(conversationAB);

    const { count } = await redeClient(adminClient())
      .from("rede_conversas")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("keeps one row under concurrent creation of the same pair", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        redeClient(index % 2 === 0 ? userB.client : outsider.client).rpc(
          "rede_criar_conversa_1a1",
          {
            outro_user_id: index % 2 === 0 ? outsider.id : userB.id,
          }
        )
      )
    );
    expect(attempts.every((attempt) => attempt.error === null)).toBe(true);
    expect(new Set(attempts.map((attempt) => attempt.data)).size).toBe(1);

    const lowId = userB.id < outsider.id ? userB.id : outsider.id;
    const highId = userB.id < outsider.id ? outsider.id : userB.id;
    const rows = await redeClient(adminClient())
      .from("rede_conversas")
      .select("id")
      .eq("user_low_id", lowId)
      .eq("user_high_id", highId);
    expect(rows.data).toHaveLength(1);
  });

  it("lets participants read the conversation and participant list only", async () => {
    for (const user of [userA, userB]) {
      const conversations = await redeClient(user.client)
        .from("rede_conversas")
        .select("id")
        .eq("id", conversationAB);
      const participants = await redeClient(user.client)
        .from("rede_conversas_participantes")
        .select("user_id")
        .eq("conversa_id", conversationAB);
      expect(conversations.data).toEqual([{ id: conversationAB }]);
      expect(participants.data).toHaveLength(2);
    }

    const hidden = await redeClient(outsider.client)
      .from("rede_conversas_participantes")
      .select("user_id")
      .eq("conversa_id", conversationAB);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toHaveLength(0);
  });

  it("lets participants insert/read messages and hides them from outsiders", async () => {
    const inserted = await redeClient(userA.client)
      .from("rede_mensagens")
      .insert({
        conversa_id: conversationAB,
        autor_id: userA.id,
        texto: "oi",
      })
      .select("id,texto")
      .single();
    expect(inserted.error).toBeNull();
    messageAB = inserted.data?.id as string;

    const peer = await redeClient(userB.client)
      .from("rede_mensagens")
      .select("texto")
      .eq("id", inserted.data?.id);
    const hidden = await redeClient(outsider.client)
      .from("rede_mensagens")
      .select("texto")
      .eq("id", inserted.data?.id);
    expect(peer.data).toEqual([{ texto: "oi" }]);
    expect(hidden.data).toHaveLength(0);
  });

  it("lets only the recipient mark a message as read", async () => {
    const readAt = new Date().toISOString();
    const recipient = await redeClient(userB.client)
      .from("rede_mensagens")
      .update({ lida_em: readAt })
      .eq("id", messageAB)
      .select("id");
    const author = await redeClient(userA.client)
      .from("rede_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("id", messageAB)
      .select("id");
    const intruder = await redeClient(outsider.client)
      .from("rede_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("id", messageAB)
      .select("id");
    const structural = await redeClient(userB.client)
      .from("rede_mensagens")
      .update({ texto: "alterada" })
      .eq("id", messageAB);

    expect(recipient.error).toBeNull();
    expect(recipient.data).toEqual([{ id: messageAB }]);
    expect(author.data).toHaveLength(0);
    expect(intruder.data).toHaveLength(0);
    expect(structural.error?.code).toBe("42501");
  });

  it("delivers Realtime inserts to participants but not outsiders", async () => {
    const participantEvents: unknown[] = [];
    const outsiderEvents: unknown[] = [];
    const participantChannel = redeClient(userB.client)
      .channel(`rd06-participant-${conversationAB}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rede_mensagens",
          filter: `conversa_id=eq.${conversationAB}`,
        },
        (payload) => participantEvents.push(payload)
      );
    const outsiderChannel = redeClient(outsider.client)
      .channel(`rd06-outsider-${conversationAB}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rede_mensagens",
          filter: `conversa_id=eq.${conversationAB}`,
        },
        (payload) => outsiderEvents.push(payload)
      );

    const subscribe = async (channel: typeof participantChannel) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Realtime subscription timed out")),
          5000
        );
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(timeout);
            resolve();
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            clearTimeout(timeout);
            reject(new Error(`Realtime subscription failed: ${status}`));
          }
        });
      });

    try {
      await Promise.all([
        subscribe(participantChannel),
        subscribe(outsiderChannel),
      ]);
      // A cold local Realtime container reports SUBSCRIBED before its WAL
      // listener is ready. Send bounded probes instead of hiding that startup
      // behavior behind an unbounded sleep or accepting a missing event.
      for (
        let attempt = 1;
        attempt <= 3 && participantEvents.length === 0;
        attempt += 1
      ) {
        const inserted = await redeClient(userA.client)
          .from("rede_mensagens")
          .insert({
            conversa_id: conversationAB,
            autor_id: userA.id,
            texto: `tempo real ${attempt}`,
          });
        expect(inserted.error).toBeNull();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(participantEvents.length).toBeGreaterThan(0);
      expect(outsiderEvents).toHaveLength(0);
    } finally {
      await Promise.all([
        redeClient(userB.client).removeChannel(participantChannel),
        redeClient(outsider.client).removeChannel(outsiderChannel),
      ]);
    }
  }, 15_000);

  it("rejects forged authors, outsider writes, empty messages and non-members", async () => {
    const forged = await redeClient(userB.client)
      .from("rede_mensagens")
      .insert({
        conversa_id: conversationAB,
        autor_id: userA.id,
        texto: "forjada",
      });
    const outsiderWrite = await redeClient(outsider.client)
      .from("rede_mensagens")
      .insert({
        conversa_id: conversationAB,
        autor_id: outsider.id,
        texto: "intrusa",
      });
    const empty = await redeClient(userA.client).from("rede_mensagens").insert({
      conversa_id: conversationAB,
      autor_id: userA.id,
      texto: "   ",
    });
    const nonMemberConversation = await redeClient(nonMember.client).rpc(
      "rede_criar_conversa_1a1",
      { outro_user_id: userA.id }
    );

    for (const result of [
      forged,
      outsiderWrite,
      empty,
      nonMemberConversation,
    ]) {
      expect(result.error).not.toBeNull();
    }
  });

  it("serializes concurrent blocking and conversation creation", async () => {
    const self = await redeClient(userA.client).rpc("rede_criar_conversa_1a1", {
      outro_user_id: userA.id,
    });
    const [block, racingConversation] = await Promise.all([
      redeClient(userA.client)
        .from("rede_bloqueios")
        .insert({ bloqueador_id: userA.id, bloqueado_id: outsider.id }),
      redeClient(outsider.client).rpc("rede_criar_conversa_1a1", {
        outro_user_id: userA.id,
      }),
    ]);
    const blockedAfterCommit = await redeClient(outsider.client).rpc(
      "rede_criar_conversa_1a1",
      { outro_user_id: userA.id }
    );

    const blockError = block.error;
    expect(blockError).toBeNull();
    expect(self.error).not.toBeNull();
    expect(blockedAfterCommit.error).not.toBeNull();
    if (racingConversation.error === null) {
      const hiddenAfterBlock = await redeClient(outsider.client)
        .from("rede_conversas")
        .select("id")
        .eq("id", racingConversation.data);
      expect(hiddenAfterBlock.data).toHaveLength(0);
    }
  });

  it("does not grant direct conversation/participant mutation or anon access", async () => {
    const directConversation = await redeClient(userA.client)
      .from("rede_conversas")
      .insert({});
    const directParticipant = await redeClient(userA.client)
      .from("rede_conversas_participantes")
      .insert({ conversa_id: conversationAB, user_id: outsider.id });
    const anonRead = await redeClient(anonClient())
      .from("rede_mensagens")
      .select("id");

    expect(directConversation.error?.code).toBe("42501");
    expect(directParticipant.error?.code).toBe("42501");
    expect(anonRead.error?.code).toBe("42501");
  });
});
