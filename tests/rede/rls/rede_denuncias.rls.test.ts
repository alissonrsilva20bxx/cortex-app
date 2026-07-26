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

function expectRlsDenied(error: { code?: string } | null): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
}

function expectPermissionDenied(
  error: { code?: string; message: string } | null,
  table: string
): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
  expect(error?.message).toContain(`permission denied for table ${table}`);
}

function expectConstraintViolation(error: { code?: string } | null): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("23514");
}

describe("RLS: RD-07 denuncias", () => {
  const testUsers: TestUser[] = [];
  let reporter: TestUser;
  let target: TestUser;
  let admin: TestUser;
  let member: TestUser;
  let nonMember: TestUser;

  beforeAll(async () => {
    for (let index = 0; index < 5; index += 1) {
      testUsers.push(await createTestUser());
    }
    [reporter, target, admin, member, nonMember] = testUsers;

    const service = redeClient(adminClient());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await service
      .from("rede_convites")
      .insert(
        [reporter, target, admin, member].map((user) => ({
          codigo_hash: `rd07-member-${user.id}`,
          usado_por: user.id,
          usado_em: now,
          expira_em: expiresAt,
        }))
      );
    if (membershipError) {
      throw new Error(
        `Failed to seed Rede memberships: ${membershipError.message}`
      );
    }

    const { error: adminError } = await service
      .from("rede_admins")
      .insert({ user_id: admin.id });
    if (adminError) {
      throw new Error(`Failed to seed Rede admin: ${adminError.message}`);
    }
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("lets a member report another user and read only their own report", async () => {
    const inserted = await redeClient(reporter.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "usuario",
        alvo_id: target.id,
        motivo: "assedio",
        descricao: "comportamento hostil recorrente",
      })
      .select("id,status")
      .single();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.status).toBe("pendente");
    const reportId = inserted.data?.id as string;

    const own = await redeClient(reporter.client)
      .from("rede_denuncias")
      .select("id")
      .eq("id", reportId);
    const outsider = await redeClient(member.client)
      .from("rede_denuncias")
      .select("id")
      .eq("id", reportId);
    const asAdmin = await redeClient(admin.client)
      .from("rede_denuncias")
      .select("id")
      .eq("id", reportId);

    expect(own.data).toEqual([{ id: reportId }]);
    expect(outsider.error).toBeNull();
    expect(outsider.data).toHaveLength(0);
    expect(asAdmin.data).toEqual([{ id: reportId }]);
  });

  it("accepts every polymorphic alvo_tipo", async () => {
    const service = redeClient(adminClient());
    const alvos = ["post", "comentario", "usuario", "mensagem"] as const;
    for (const alvo_tipo of alvos) {
      const { error } = await redeClient(reporter.client)
        .from("rede_denuncias")
        .insert({
          denunciante_id: reporter.id,
          alvo_tipo,
          alvo_id: target.id,
          motivo: "outro",
        });
      expect(error).toBeNull();
    }
    const { count } = await service
      .from("rede_denuncias")
      .select("id", { count: "exact", head: true })
      .eq("denunciante_id", reporter.id);
    expect(count).toBeGreaterThanOrEqual(alvos.length);
  });

  it("rejects a report forged on behalf of another user", async () => {
    const { error } = await redeClient(member.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "spam",
      });

    expectRlsDenied(error);
  });

  it("rejects a report from an authenticated non-member", async () => {
    const { error } = await redeClient(nonMember.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: nonMember.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "spam",
      });

    expectRlsDenied(error);
  });

  it("rejects inserting a report that is already reviewed", async () => {
    const withStatus = await redeClient(member.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: member.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "spam",
        status: "revisada",
      });
    const withReviewer = await redeClient(member.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: member.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "spam",
        revisado_por: admin.id,
      });

    expectRlsDenied(withStatus.error);
    expectRlsDenied(withReviewer.error);
  });

  it("rejects an empty or oversized descricao", async () => {
    const empty = await redeClient(member.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: member.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "spam",
        descricao: "   ",
      });
    const oversized = await redeClient(member.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: member.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "spam",
        descricao: "x".repeat(2001),
      });

    expectConstraintViolation(empty.error);
    expectConstraintViolation(oversized.error);
  });

  it("lets only an admin move a report from pendente to revisada", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "conteudo_impropio",
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const reportId = seeded.data.id as string;

    const nonAdmin = await redeClient(member.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: new Date().toISOString(),
        revisado_por: member.id,
      })
      .eq("id", reportId)
      .select("id");
    const byAdmin = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: new Date().toISOString(),
        revisado_por: admin.id,
      })
      .eq("id", reportId)
      .select("status,revisado_por");

    expect(nonAdmin.error).toBeNull();
    expect(nonAdmin.data).toHaveLength(0);
    expect(byAdmin.error).toBeNull();
    expect(byAdmin.data).toEqual([
      { status: "revisada", revisado_por: admin.id },
    ]);
  });

  it("lets an admin resolve a pending report directly", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "mensagem",
        alvo_id: target.id,
        motivo: "spam",
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const reportId = seeded.data.id as string;

    const resolved = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "resolvida",
        revisado_em: new Date().toISOString(),
        revisado_por: admin.id,
      })
      .eq("id", reportId)
      .select("status");

    expect(resolved.error).toBeNull();
    expect(resolved.data).toEqual([{ status: "resolvida" }]);
  });

  it("rejects transitions back to pendente, past resolvida, or with a forged reviewer", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "comentario",
        alvo_id: target.id,
        motivo: "outro",
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const reportId = seeded.data.id as string;

    const backToPending = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "pendente",
        revisado_em: null,
        revisado_por: null,
      })
      .eq("id", reportId);
    expectConstraintViolation(backToPending.error);

    const forgedReviewer = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: new Date().toISOString(),
        revisado_por: reporter.id,
      })
      .eq("id", reportId);
    expectConstraintViolation(forgedReviewer.error);

    const resolved = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "resolvida",
        revisado_em: new Date().toISOString(),
        revisado_por: admin.id,
      })
      .eq("id", reportId);
    expect(resolved.error).toBeNull();

    const pastResolved = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: new Date().toISOString(),
        revisado_por: admin.id,
      })
      .eq("id", reportId);
    expectConstraintViolation(pastResolved.error);
  });

  it("does not grant report deletion to authenticated users", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "spam",
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;

    const asReporter = await redeClient(reporter.client)
      .from("rede_denuncias")
      .delete()
      .eq("id", seeded.data.id as string);
    const asAdmin = await redeClient(admin.client)
      .from("rede_denuncias")
      .delete()
      .eq("id", seeded.data.id as string);

    expectPermissionDenied(asReporter.error, "rede_denuncias");
    expectPermissionDenied(asAdmin.error, "rede_denuncias");
  });

  it("does not grant any anon access", async () => {
    const anon = redeClient(anonClient());
    const select = await anon.from("rede_denuncias").select("id");
    const insert = await anon.from("rede_denuncias").insert({
      denunciante_id: reporter.id,
      alvo_tipo: "post",
      alvo_id: target.id,
      motivo: "spam",
    });
    const update = await anon
      .from("rede_denuncias")
      .update({ status: "revisada" })
      .eq("denunciante_id", reporter.id);
    const removal = await anon
      .from("rede_denuncias")
      .delete()
      .eq("denunciante_id", reporter.id);

    expectPermissionDenied(select.error, "rede_denuncias");
    expectPermissionDenied(insert.error, "rede_denuncias");
    expectPermissionDenied(update.error, "rede_denuncias");
    expectPermissionDenied(removal.error, "rede_denuncias");
  });

  it("keeps service-role access for fixture and server workflows", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "post",
        alvo_id: target.id,
        motivo: "spam",
      })
      .select("id")
      .single();
    expect(seeded.error).toBeNull();

    const removal = await service
      .from("rede_denuncias")
      .delete()
      .eq("id", seeded.data?.id as string)
      .select("id");
    expect(removal.error).toBeNull();
    expect(removal.data).toEqual([{ id: seeded.data?.id }]);
  });
});
