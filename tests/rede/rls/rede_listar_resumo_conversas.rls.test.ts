import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Issue #54: `rede_listar_resumo_conversas()` substitui o "buscar todas as
 * mensagens de todas as conversas" de `listarConversas()` por uma agregação
 * feita no banco -- uma linha por conversa, já com última mensagem e
 * contagem de não lidas.
 */

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

type ResumoRow = {
  conversa_id: string;
  outro_user_id: string;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  nao_lidas: number;
};

describe("RLS: rede_listar_resumo_conversas", () => {
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
          codigo_hash: `resumo-conversas-${user.id}`,
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

    // 3 mensagens de A, depois 2 de B (a mais recente é de B) -- deixa
    // "última mensagem" e "não lidas" com valores distintos e verificáveis
    // pra cada lado.
    for (const texto of ["Oi!", "Tudo bem?", "Vamos marcar?"]) {
      const { error } = await redeClient(userA.client)
        .from("rede_mensagens")
        .insert({ conversa_id: conversationAB, autor_id: userA.id, texto });
      if (error) throw error;
    }
    for (const texto of ["Oi, tudo!", "Pode ser sexta"]) {
      const { error } = await redeClient(userB.client)
        .from("rede_mensagens")
        .insert({ conversa_id: conversationAB, autor_id: userB.id, texto });
      if (error) throw error;
    }
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(users.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length) throw new Error("Failed to clean up test users");
  });

  it("returns the other participant, last message and unread count from A's side", async () => {
    const { data, error } = await redeClient(userA.client).rpc(
      "rede_listar_resumo_conversas"
    );
    expect(error).toBeNull();
    const rows = data as ResumoRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].outro_user_id).toBe(userB.id);
    expect(rows[0].ultima_mensagem).toBe("Pode ser sexta");
    // A recebeu as 2 mensagens de B, nenhuma marcada como lida ainda.
    expect(rows[0].nao_lidas).toBe(2);
  });

  it("returns the mirrored view from B's side (own messages never count as unread)", async () => {
    const { data, error } = await redeClient(userB.client).rpc(
      "rede_listar_resumo_conversas"
    );
    expect(error).toBeNull();
    const rows = data as ResumoRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].outro_user_id).toBe(userA.id);
    expect(rows[0].ultima_mensagem).toBe("Pode ser sexta");
    // B recebeu as 3 mensagens de A, nenhuma marcada como lida ainda.
    expect(rows[0].nao_lidas).toBe(3);
  });

  it("drops the unread count to 0 once the recipient marks messages as read", async () => {
    const { data: unread } = await redeClient(userA.client)
      .from("rede_mensagens")
      .select("id")
      .eq("conversa_id", conversationAB)
      .eq("autor_id", userB.id);
    for (const m of unread ?? []) {
      const { error } = await redeClient(userA.client)
        .from("rede_mensagens")
        .update({ lida_em: new Date().toISOString() })
        .eq("id", (m as { id: string }).id);
      if (error) throw error;
    }

    const { data, error } = await redeClient(userA.client).rpc(
      "rede_listar_resumo_conversas"
    );
    expect(error).toBeNull();
    expect((data as ResumoRow[])[0].nao_lidas).toBe(0);
  });

  it("returns nothing for someone who isn't a participant of any conversation", async () => {
    const { data, error } = await redeClient(outsider.client).rpc(
      "rede_listar_resumo_conversas"
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("denies anon entirely (no execute grant)", async () => {
    const { error } = await redeClient(anonClient()).rpc(
      "rede_listar_resumo_conversas"
    );
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("hides the conversation from both sides once either blocks the other", async () => {
    const blockerBlocked = await createTestUser();
    users.push(blockerBlocked);
    const target = await createTestUser();
    users.push(target);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await redeClient(adminClient())
      .from("rede_convites")
      .insert(
        [blockerBlocked, target].map((user) => ({
          codigo_hash: `resumo-conversas-block-${user.id}`,
          usado_por: user.id,
          usado_em: now,
          expira_em: expiresAt,
        }))
      );
    if (membershipError) throw membershipError;

    const created = await redeClient(blockerBlocked.client).rpc(
      "rede_criar_conversa_1a1",
      { outro_user_id: target.id }
    );
    if (created.error || typeof created.data !== "string") {
      throw new Error(
        `Failed to create conversation: ${created.error?.message}`
      );
    }
    await redeClient(blockerBlocked.client).from("rede_mensagens").insert({
      conversa_id: created.data,
      autor_id: blockerBlocked.id,
      texto: "antes do bloqueio",
    });

    const { error: blockError } = await redeClient(blockerBlocked.client)
      .from("rede_bloqueios")
      .insert({
        bloqueador_id: blockerBlocked.id,
        bloqueado_id: target.id,
      });
    if (blockError) throw blockError;

    const fromBlocker = await redeClient(blockerBlocked.client).rpc(
      "rede_listar_resumo_conversas"
    );
    const fromTarget = await redeClient(target.client).rpc(
      "rede_listar_resumo_conversas"
    );
    expect(fromBlocker.error).toBeNull();
    expect(fromBlocker.data).toEqual([]);
    expect(fromTarget.error).toBeNull();
    expect(fromTarget.data).toEqual([]);
  });

  // Issue #55, reconciliado nesta RPC pela migration 0024 (mesma regra que
  // antes vivia em JS em listarConversas): oculta_desde só continua
  // escondendo enquanto não houver mensagem nova depois da exclusão.
  it("omits a conversation the caller hid (issue #55) until a new message arrives", async () => {
    const { error: hideError } = await redeClient(userA.client).rpc(
      "rede_ocultar_conversa",
      { alvo_conversa_id: conversationAB }
    );
    expect(hideError).toBeNull();

    const hidden = await redeClient(userA.client).rpc(
      "rede_listar_resumo_conversas"
    );
    expect(hidden.error).toBeNull();
    expect(hidden.data).toEqual([]);

    // B continua vendo normalmente -- oculta_desde só existe na linha de A.
    const stillVisibleForB = await redeClient(userB.client).rpc(
      "rede_listar_resumo_conversas"
    );
    expect((stillVisibleForB.data as ResumoRow[])[0]?.conversa_id).toBe(
      conversationAB
    );

    const { error: newMessageError } = await redeClient(userB.client)
      .from("rede_mensagens")
      .insert({
        conversa_id: conversationAB,
        autor_id: userB.id,
        texto: "Ainda por aqui?",
      });
    expect(newMessageError).toBeNull();

    const reappeared = await redeClient(userA.client).rpc(
      "rede_listar_resumo_conversas"
    );
    expect(reappeared.error).toBeNull();
    const rows = reappeared.data as ResumoRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].ultima_mensagem).toBe("Ainda por aqui?");
  });
});
