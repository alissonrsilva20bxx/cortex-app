import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
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
  let reviewerToDelete: TestUser;
  let postId: string;
  let commentId: string;
  let messageId: string;
  let hiddenMessageId: string;

  beforeAll(async () => {
    for (let index = 0; index < 6; index += 1) {
      testUsers.push(await createTestUser());
    }
    [reporter, target, admin, member, nonMember, reviewerToDelete] = testUsers;

    const service = redeClient(adminClient());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await service
      .from("rede_convites")
      .insert(
        [reporter, target, admin, member, reviewerToDelete].map((user) => ({
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
      .insert([{ user_id: admin.id }, { user_id: reviewerToDelete.id }]);
    if (adminError) {
      throw new Error(`Failed to seed Rede admin: ${adminError.message}`);
    }

    const post = await service
      .from("rede_posts")
      .insert({ autor_id: target.id, categoria: "dica", texto: "alvo real" })
      .select("id")
      .single();
    if (post.error) throw post.error;
    postId = post.data.id;
    const comment = await service
      .from("rede_comentarios")
      .insert({
        post_id: postId,
        autor_id: target.id,
        texto: "comentário real",
      })
      .select("id")
      .single();
    if (comment.error) throw comment.error;
    commentId = comment.data.id;

    const visibleConversation = await redeClient(reporter.client).rpc(
      "rede_criar_conversa_1a1",
      { outro_user_id: target.id }
    );
    if (visibleConversation.error) throw visibleConversation.error;
    const message = await redeClient(target.client)
      .from("rede_mensagens")
      .insert({
        conversa_id: visibleConversation.data,
        autor_id: target.id,
        texto: "mensagem real",
      })
      .select("id")
      .single();
    if (message.error) throw message.error;
    messageId = message.data.id;

    const hiddenConversation = await redeClient(member.client).rpc(
      "rede_criar_conversa_1a1",
      { outro_user_id: target.id }
    );
    if (hiddenConversation.error) throw hiddenConversation.error;
    const hiddenMessage = await redeClient(member.client)
      .from("rede_mensagens")
      .insert({
        conversa_id: hiddenConversation.data,
        autor_id: member.id,
        texto: "mensagem invisível ao denunciante",
      })
      .select("id")
      .single();
    if (hiddenMessage.error) throw hiddenMessage.error;
    hiddenMessageId = hiddenMessage.data.id;
  });

  afterAll(async () => {
    const cleanup = [];
    for (const user of testUsers) {
      try {
        await deleteTestUser(user);
      } catch (error) {
        cleanup.push(error);
      }
    }
    const failures = cleanup;
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
    const alvos = [
      ["post", postId],
      ["comentario", commentId],
      ["usuario", target.id],
      ["mensagem", messageId],
    ] as const;
    for (const [alvo_tipo, alvo_id] of alvos) {
      const { error } = await redeClient(reporter.client)
        .from("rede_denuncias")
        .insert({
          denunciante_id: reporter.id,
          alvo_tipo,
          alvo_id,
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

  it("rejects missing, mismatched, and invisible polymorphic targets", async () => {
    const invalid = [
      { alvo_tipo: "post", alvo_id: randomUUID() },
      { alvo_tipo: "post", alvo_id: commentId },
      { alvo_tipo: "comentario", alvo_id: postId },
      { alvo_tipo: "usuario", alvo_id: randomUUID() },
      { alvo_tipo: "usuario", alvo_id: nonMember.id },
      { alvo_tipo: "mensagem", alvo_id: hiddenMessageId },
    ] as const;
    for (const alvo of invalid) {
      const result = await redeClient(reporter.client)
        .from("rede_denuncias")
        .insert({
          denunciante_id: reporter.id,
          ...alvo,
          motivo: "outro",
        });
      expectConstraintViolation(result.error);
    }
  });

  it("preserves reviewer audit when the admin account is deleted", async () => {
    const seeded = await redeClient(reporter.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "post",
        alvo_id: postId,
        motivo: "spam",
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const reviewedAt = new Date().toISOString();
    const reviewed = await redeClient(reviewerToDelete.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: reviewedAt,
        revisado_por: reviewerToDelete.id,
        revisado_por_auditoria: reviewerToDelete.id,
      })
      .eq("id", seeded.data.id);
    expect(reviewed.error).toBeNull();

    const overwriteAudit = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "resolvida",
        revisado_em: new Date(Date.now() + 1000).toISOString(),
        resolvido_em: new Date().toISOString(),
        resolvido_por: admin.id,
        resolvido_por_auditoria: admin.id,
      })
      .eq("id", seeded.data.id);
    expectConstraintViolation(overwriteAudit.error);

    const manualClear = await redeClient(reviewerToDelete.client)
      .from("rede_denuncias")
      .update({ revisado_por: null })
      .eq("id", seeded.data.id);
    expectConstraintViolation(manualClear.error);

    await deleteTestUser(reviewerToDelete);
    testUsers.splice(testUsers.indexOf(reviewerToDelete), 1);
    const audit = await redeClient(adminClient())
      .from("rede_denuncias")
      .select("revisado_por,revisado_por_auditoria,revisado_em")
      .eq("id", seeded.data.id)
      .single();
    expect(audit.error).toBeNull();
    expect(audit.data?.revisado_por).toBeNull();
    expect(audit.data?.revisado_por_auditoria).toBe(reviewerToDelete.id);
    expect(Date.parse(audit.data?.revisado_em)).toBe(Date.parse(reviewedAt));
  });

  it("rejects user targets across a mutual block in both directions", async () => {
    for (const blocker of [reporter, target]) {
      const blocked = blocker.id === reporter.id ? target : reporter;
      const block = await redeClient(blocker.client)
        .from("rede_bloqueios")
        .insert({ bloqueador_id: blocker.id, bloqueado_id: blocked.id });
      expect(block.error).toBeNull();
      const report = await redeClient(reporter.client)
        .from("rede_denuncias")
        .insert({
          denunciante_id: reporter.id,
          alvo_tipo: "usuario",
          alvo_id: target.id,
          motivo: "outro",
        });
      expectConstraintViolation(report.error);
      const cleanup = await redeClient(blocker.client)
        .from("rede_bloqueios")
        .delete()
        .eq("bloqueador_id", blocker.id)
        .eq("bloqueado_id", blocked.id);
      expect(cleanup.error).toBeNull();
    }
  });

  it("rejects a report forged on behalf of another user", async () => {
    const { error } = await redeClient(member.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: reporter.id,
        alvo_tipo: "post",
        alvo_id: postId,
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
        alvo_id: postId,
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
        alvo_id: postId,
        motivo: "spam",
        status: "revisada",
      });
    const withReviewer = await redeClient(member.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: member.id,
        alvo_tipo: "post",
        alvo_id: postId,
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
        alvo_id: postId,
        motivo: "spam",
        descricao: "   ",
      });
    const oversized = await redeClient(member.client)
      .from("rede_denuncias")
      .insert({
        denunciante_id: member.id,
        alvo_tipo: "post",
        alvo_id: postId,
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
        alvo_id: postId,
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
        revisado_por_auditoria: member.id,
      })
      .eq("id", reportId)
      .select("id");
    const missingLiveReviewer = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: new Date().toISOString(),
        revisado_por: null,
        revisado_por_auditoria: admin.id,
      })
      .eq("id", reportId);
    const byAdmin = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: new Date().toISOString(),
        revisado_por: admin.id,
        revisado_por_auditoria: admin.id,
      })
      .eq("id", reportId)
      .select("status,revisado_por");

    expect(nonAdmin.error).toBeNull();
    expect(nonAdmin.data).toHaveLength(0);
    expectConstraintViolation(missingLiveReviewer.error);
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
        alvo_id: messageId,
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
        resolvido_em: new Date().toISOString(),
        resolvido_por: admin.id,
        resolvido_por_auditoria: admin.id,
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
        alvo_id: commentId,
        motivo: "outro",
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const reportId = seeded.data.id as string;

    const forgedReviewer = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: new Date().toISOString(),
        revisado_por: reporter.id,
        revisado_por_auditoria: reporter.id,
      })
      .eq("id", reportId);
    expectConstraintViolation(forgedReviewer.error);

    const reviewedAt = new Date().toISOString();
    const reviewed = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: reviewedAt,
        revisado_por: admin.id,
        revisado_por_auditoria: admin.id,
      })
      .eq("id", reportId);
    expect(reviewed.error).toBeNull();

    const backToPending = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "pendente",
        revisado_em: null,
        revisado_por: null,
        revisado_por_auditoria: null,
      })
      .eq("id", reportId);
    expectConstraintViolation(backToPending.error);

    const resolved = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "resolvida",
        resolvido_em: new Date().toISOString(),
        resolvido_por: admin.id,
        resolvido_por_auditoria: admin.id,
      })
      .eq("id", reportId);
    expect(resolved.error).toBeNull();

    const pastResolved = await redeClient(admin.client)
      .from("rede_denuncias")
      .update({
        status: "revisada",
        revisado_em: new Date().toISOString(),
        revisado_por: admin.id,
        revisado_por_auditoria: admin.id,
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
        alvo_id: postId,
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
      alvo_id: postId,
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
        alvo_id: postId,
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
