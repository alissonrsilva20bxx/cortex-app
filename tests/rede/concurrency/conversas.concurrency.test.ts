import { afterAll, describe, expect, it } from "vitest";

import { abrirConversa1a1 } from "../../../lib/rede/mensagens";
import { adminClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * RD-19: duas tentativas simultâneas de abrir a "mesma" conversa 1:1 entre
 * o mesmo par de usuários. A tabela rede_conversas tem UNIQUE
 * (user_low_id, user_high_id) e a RPC rede_criar_conversa_1a1 (chamada por
 * lib/rede/mensagens.ts#abrirConversa1a1) toma um advisory lock por par
 * antes do upsert. tests/rede/rls/messaging.rls.test.ts já prova isso
 * chamando a RPC diretamente; este teste prova o mesmo invariante através
 * da camada de serviço que a aplicação de fato usa, para que uma regressão
 * que insira um passo não-atômico no wrapper (ex.: um SELECT prévio
 * client-side) seja pega aqui mesmo que a RPC continue correta.
 */
describe("RD-19 concorrência: rede_conversas (1:1)", () => {
  const testUsers: TestUser[] = [];

  async function seedMembership(userId: string): Promise<void> {
    const { error } = await adminClient()
      .from("rede_convites")
      .insert({
        codigo_hash: `rd19-conversa-member-${userId}`,
        usado_por: userId,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (error) {
      throw new Error(`Failed to seed Rede membership: ${error.message}`);
    }
  }

  async function novoPar(): Promise<[TestUser, TestUser]> {
    const a = await createTestUser();
    const b = await createTestUser();
    testUsers.push(a, b);
    await seedMembership(a.id);
    await seedMembership(b.id);
    return [a, b];
  }

  async function contarConversas(a: TestUser, b: TestUser): Promise<number> {
    const lowId = a.id < b.id ? a.id : b.id;
    const highId = a.id < b.id ? b.id : a.id;
    const { count, error } = await adminClient()
      .from("rede_conversas")
      .select("id", { count: "exact", head: true })
      .eq("user_low_id", lowId)
      .eq("user_high_id", highId);
    if (error) {
      throw new Error(`Failed to count conversations: ${error.message}`);
    }
    return count ?? 0;
  }

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("collapses concurrent opens of the same pair from both sides into one conversation", async () => {
    const [a, b] = await novoPar();

    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        abrirConversa1a1(index % 2 === 0 ? a.client : b.client, {
          outroUserId: index % 2 === 0 ? b.id : a.id,
        })
      )
    );

    const rejected = attempts.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected).toHaveLength(0);

    const conversaIds = new Set(
      attempts
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value)
    );
    expect(conversaIds.size).toBe(1);
    expect(await contarConversas(a, b)).toBe(1);
  });

  it("keeps one row per pair across several independent pairs opened at once", async () => {
    const pairs = await Promise.all([novoPar(), novoPar(), novoPar()]);

    const attempts = await Promise.allSettled(
      pairs.flatMap(([a, b]) => [
        abrirConversa1a1(a.client, { outroUserId: b.id }),
        abrirConversa1a1(b.client, { outroUserId: a.id }),
      ])
    );

    const rejected = attempts.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(0);

    for (const [a, b] of pairs) {
      expect(await contarConversas(a, b)).toBe(1);
    }
  });
});
