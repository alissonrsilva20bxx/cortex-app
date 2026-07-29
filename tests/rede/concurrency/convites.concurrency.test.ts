import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { adminClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * RD-19: dois resgates simultâneos do mesmo código de convite não podem
 * passar os dois. supabase/migrations/0015_rede_convites_rpc.sql resolve
 * isso com um único `UPDATE ... WHERE usado_por IS NULL AND expira_em > now()
 * RETURNING` dentro de `rede_resgatar_convite` — o segundo UPDATE concorrente
 * espera o lock de linha do primeiro e, ao continuar, seu WHERE não casa
 * mais (usado_por já não é nulo), então afeta zero linhas. Este teste prova
 * isso contra Postgres real, disparando o resgate de dois usuários
 * diferentes ao mesmo tempo pelo mesmo código — o cenário descrito em
 * BACKEND_TICKETS.md (RD-15 critério de aceite / RD-19).
 */
describe("RD-19 concorrência: resgate de convite", () => {
  const testUsers: TestUser[] = [];

  function hashHex(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  async function seedConvite(): Promise<string> {
    const codigoHash = hashHex(randomUUID());
    const { error } = await adminClient()
      .from("rede_convites")
      .insert({
        codigo_hash: codigoHash,
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (error) {
      throw new Error(`Failed to seed invite: ${error.message}`);
    }
    return codigoHash;
  }

  async function novoPar(): Promise<[TestUser, TestUser]> {
    const a = await createTestUser();
    const b = await createTestUser();
    testUsers.push(a, b);
    return [a, b];
  }

  function redeemAttempt(user: TestUser, codigoHash: string) {
    return user.client.rpc("rede_resgatar_convite", {
      codigo_hash: codigoHash,
      ip_hash: hashHex(`${user.id}-${randomUUID()}`),
    });
  }

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("lets exactly one of two concurrent redeemers claim the same code", async () => {
    const trials = await Promise.all([novoPar(), novoPar(), novoPar()]);

    for (const [a, b] of trials) {
      const codigoHash = await seedConvite();

      const [resultA, resultB] = await Promise.all([
        redeemAttempt(a, codigoHash),
        redeemAttempt(b, codigoHash),
      ]);

      expect(resultA.error).toBeNull();
      expect(resultB.error).toBeNull();

      const statuses = [resultA, resultB].map(
        (result) => (result.data as { status: string }).status
      );
      expect(statuses.sort()).toEqual(["invalido", "resgatado"]);

      const { data: row, error: rowError } = await adminClient()
        .from("rede_convites")
        .select("usado_por,usado_em")
        .eq("codigo_hash", codigoHash)
        .single();
      expect(rowError).toBeNull();
      expect(row?.usado_por).not.toBeNull();
      expect([a.id, b.id]).toContain(row?.usado_por);
      expect(row?.usado_em).not.toBeNull();
    }
  });

  it("still lets a solo redemption succeed with no race involved", async () => {
    const a = await createTestUser();
    testUsers.push(a);
    const codigoHash = await seedConvite();

    const { data, error } = await redeemAttempt(a, codigoHash);

    expect(error).toBeNull();
    expect((data as { status: string }).status).toBe("resgatado");
  });

  it("rejects redemption of an already-used code without duplicating usado_por", async () => {
    const [a, b] = await novoPar();
    const codigoHash = await seedConvite();

    const first = await redeemAttempt(a, codigoHash);
    expect(first.error).toBeNull();
    expect((first.data as { status: string }).status).toBe("resgatado");

    const second = await redeemAttempt(b, codigoHash);
    expect(second.error).toBeNull();
    expect((second.data as { status: string }).status).toBe("invalido");

    const { data: row } = await adminClient()
      .from("rede_convites")
      .select("usado_por")
      .eq("codigo_hash", codigoHash)
      .single();
    expect(row?.usado_por).toBe(a.id);
  });
});
