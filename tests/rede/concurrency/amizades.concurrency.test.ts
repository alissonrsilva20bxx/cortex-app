import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enviarPedidoAmizade } from "../../../lib/rede/social";
import { adminClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * RD-19: pedido de amizade duplicado enviado nos dois sentidos ao mesmo
 * tempo. lib/rede/social.ts#enviarPedidoAmizade já trata a corrida (o INSERT
 * perdedor recebe 23505, reconsulta o pedido inverso e o aceita em vez de
 * propagar o erro) — este teste prova que isso se sustenta sob concorrência
 * real contra Postgres, não só no caminho feliz sequencial coberto por
 * tests/rede/services/social.test.ts (que mocka o client).
 */
describe("RD-19 concorrência: rede_amizades", () => {
  const testUsers: TestUser[] = [];

  async function seedMembership(userId: string): Promise<void> {
    const { error } = await adminClient()
      .from("rede_convites")
      .insert({
        codigo_hash: `rd19-amizade-member-${userId}`,
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

  async function contarLinhas(a: TestUser, b: TestUser): Promise<number> {
    const { count, error } = await adminClient()
      .from("rede_amizades")
      .select("id", { count: "exact", head: true })
      .or(
        `and(solicitante_id.eq.${a.id},destinatario_id.eq.${b.id}),` +
          `and(solicitante_id.eq.${b.id},destinatario_id.eq.${a.id})`
      );
    if (error) {
      throw new Error(`Failed to count friendship rows: ${error.message}`);
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

  it("collapses simultaneous opposite-direction requests into exactly one accepted friendship", async () => {
    const pairs = await Promise.all([novoPar(), novoPar(), novoPar()]);

    const attempts = await Promise.allSettled(
      pairs.flatMap(([a, b]) => [
        enviarPedidoAmizade(a.client as never, { destinatarioId: b.id }),
        enviarPedidoAmizade(b.client as never, { destinatarioId: a.id }),
      ])
    );

    const rejected = attempts.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(0);

    for (const [a, b] of pairs) {
      const count = await contarLinhas(a, b);
      expect(count).toBe(1);

      const { data, error } = await adminClient()
        .from("rede_amizades")
        .select("status,respondido_em")
        .or(
          `and(solicitante_id.eq.${a.id},destinatario_id.eq.${b.id}),` +
            `and(solicitante_id.eq.${b.id},destinatario_id.eq.${a.id})`
        )
        .single();
      expect(error).toBeNull();
      expect(data?.status).toBe("aceita");
      expect(data?.respondido_em).not.toBeNull();
    }
  });

  it("still lets a solo request land as pending with no race involved", async () => {
    const [a, b] = await novoPar();

    const pedido = await enviarPedidoAmizade(a.client as never, {
      destinatarioId: b.id,
    });

    expect(pedido.status).toBe("pendente");
    expect(await contarLinhas(a, b)).toBe(1);
  });
});
