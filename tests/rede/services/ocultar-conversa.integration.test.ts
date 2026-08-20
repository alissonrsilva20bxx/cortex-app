import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarConversas, ocultarConversa } from "../../../lib/rede/mensagens";
import { adminClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Issue #55: prova, contra Supabase local de verdade, que excluir uma
 * conversa a esconde só do lado de quem excluiu, e que ela reaparece
 * sozinha na lista se a outra pessoa mandar mensagem depois disso -- sem
 * nenhuma ação explícita de "desocultar".
 */
describe("ocultar conversa (excluir #55) contra Supabase local", () => {
  let userA: TestUser;
  let userB: TestUser;
  let conversaId: string;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();

    const service = adminClient();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const invite = await service.from("rede_convites").insert(
      [userA, userB].map((user) => ({
        codigo_hash: `ocultar-conversa-integration-${user.id}`,
        usado_por: user.id,
        usado_em: now,
        expira_em: expiresAt,
      }))
    );
    if (invite.error) throw invite.error;

    // listarConversas resolve o perfil da outra pessoa -- sem isso a
    // conversa fica de fora por "perfil incompleto", nada a ver com #55.
    const profiles = await service.from("rede_perfis").insert(
      [userA, userB].map((user) => ({
        user_id: user.id,
        nome_exibicao: `Teste ${user.id.slice(0, 8)}`,
        cor_avatar: "#123456",
      }))
    );
    if (profiles.error) throw profiles.error;

    const created = await userA.client.rpc("rede_criar_conversa_1a1", {
      outro_user_id: userB.id,
    });
    if (created.error || typeof created.data !== "string") {
      throw new Error(
        `Failed to create conversation: ${created.error?.message}`
      );
    }
    conversaId = created.data;

    const { error } = await userA.client.from("rede_mensagens").insert({
      conversa_id: conversaId,
      autor_id: userA.id,
      texto: "Oi!",
    });
    if (error) throw error;
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

  it("hides the conversation for A only -- B still sees it normally", async () => {
    expect((await listarConversas(userA.client)).map((c) => c.id)).toContain(
      conversaId
    );

    await ocultarConversa(userA.client, { conversaId });

    expect(
      (await listarConversas(userA.client)).map((c) => c.id)
    ).not.toContain(conversaId);
    expect((await listarConversas(userB.client)).map((c) => c.id)).toContain(
      conversaId
    );
  });

  it("reappears for A once B sends a new message -- no explicit unhide needed", async () => {
    const { error } = await userB.client.from("rede_mensagens").insert({
      conversa_id: conversaId,
      autor_id: userB.id,
      texto: "Ainda por aqui?",
    });
    if (error) throw error;

    const conversasDeA = await listarConversas(userA.client);
    const reaparecida = conversasDeA.find((c) => c.id === conversaId);
    expect(reaparecida).toBeDefined();
    expect(reaparecida?.ultimaMensagem).toBe("Ainda por aqui?");
  });
});
