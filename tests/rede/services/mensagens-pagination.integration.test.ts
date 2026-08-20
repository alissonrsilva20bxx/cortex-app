import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarMensagens } from "../../../lib/rede/mensagens";
import { adminClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Issue #54: `listarMensagens` buscava o histórico inteiro da conversa de
 * uma vez. Este teste prova, contra Supabase local de verdade (não
 * mockado), que o cursor por `criado_em` realmente pagina sem pular nem
 * repetir mensagens -- um bug de off-by-one aqui não apareceria num teste
 * só com a cadeia de chamadas mockada.
 */
describe("listarMensagens pagina de verdade contra Supabase local", () => {
  let userA: TestUser;
  let userB: TestUser;
  let conversaId: string;
  const textos = ["m1", "m2", "m3", "m4", "m5"];

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();

    const service = adminClient();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const invite = await service.from("rede_convites").insert(
      [userA, userB].map((user) => ({
        codigo_hash: `mensagens-pagination-${user.id}`,
        usado_por: user.id,
        usado_em: now,
        expira_em: expiresAt,
      }))
    );
    if (invite.error) throw invite.error;

    const created = await userA.client.rpc("rede_criar_conversa_1a1", {
      outro_user_id: userB.id,
    });
    if (created.error || typeof created.data !== "string") {
      throw new Error(
        `Failed to create conversation: ${created.error?.message}`
      );
    }
    conversaId = created.data;

    // Timestamps explícitos (via service role) -- em ordem crescente e
    // longe o bastante uma da outra pra nunca empatar por precisão do
    // relógio, garantindo uma ordem determinística pra paginar contra.
    for (let i = 0; i < textos.length; i += 1) {
      const { error } = await service.from("rede_mensagens").insert({
        conversa_id: conversaId,
        autor_id: userA.id,
        texto: textos[i],
        criado_em: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      });
      if (error) throw error;
    }
  });

  afterAll(async () => {
    const results = await Promise.allSettled([
      deleteTestUser(userA),
      deleteTestUser(userB),
    ]);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("returns the most recent page first, oldest-to-newest within the page", async () => {
    const page1 = await listarMensagens(userB.client, conversaId, {
      limit: 2,
    });
    expect(page1.map((m) => m.texto)).toEqual(["m4", "m5"]);
  });

  it("walks backwards through all pages via the cursor without gaps or repeats", async () => {
    const page1 = await listarMensagens(userB.client, conversaId, {
      limit: 2,
    });
    const page2 = await listarMensagens(userB.client, conversaId, {
      limit: 2,
      antesDe: page1[0].criadoEm,
    });
    const page3 = await listarMensagens(userB.client, conversaId, {
      limit: 2,
      antesDe: page2[0].criadoEm,
    });

    expect(page2.map((m) => m.texto)).toEqual(["m2", "m3"]);
    expect(page3.map((m) => m.texto)).toEqual(["m1"]);

    const seen = [...page3, ...page2, ...page1].map((m) => m.texto);
    expect(seen).toEqual(textos);
  });
});
