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

function expectForeignKeyViolation(error: { code?: string } | null): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("23503");
}

describe("RLS: personas editoriais (moderação sem impersonação, #80/#81)", () => {
  const testUsers: TestUser[] = [];
  let admin: TestUser;
  let adminToDelete: TestUser;
  let member: TestUser;
  let nonMember: TestUser;

  beforeAll(async () => {
    for (let index = 0; index < 4; index += 1) {
      testUsers.push(await createTestUser());
    }
    [admin, adminToDelete, member, nonMember] = testUsers;

    const service = redeClient(adminClient());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: membershipError } = await service
      .from("rede_convites")
      .insert(
        [admin, adminToDelete, member].map((user) => ({
          codigo_hash: `personas-member-${user.id}`,
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
      .insert([{ user_id: admin.id }, { user_id: adminToDelete.id }]);
    if (adminError) {
      throw new Error(`Failed to seed Rede admin: ${adminError.message}`);
    }
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
    if (cleanup.length > 0) {
      throw new Error(`Failed to delete ${cleanup.length} local test user(s)`);
    }
  });

  it("lets an admin create an editorial persona, defaulted to editorial and ativa", async () => {
    const inserted = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .insert({
        nome: "Dica do Dia",
        cor_avatar: "#FFAA00",
        biografia: "Persona editorial de dicas de carreira.",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      })
      .select("id,is_editorial,status")
      .single();

    expect(inserted.error).toBeNull();
    expect(inserted.data?.is_editorial).toBe(true);
    expect(inserted.data?.status).toBe("ativa");
  });

  it("rejects persona creation by a non-admin member", async () => {
    const { error } = await redeClient(member.client)
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Falsa",
        cor_avatar: "#000000",
        criado_por: member.id,
        criado_por_auditoria: member.id,
      });

    expectRlsDenied(error);
  });

  it("rejects persona creation by an authenticated non-member", async () => {
    const { error } = await redeClient(nonMember.client)
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Falsa",
        cor_avatar: "#000000",
        criado_por: nonMember.id,
        criado_por_auditoria: nonMember.id,
      });

    expectRlsDenied(error);
  });

  it("rejects an admin forging criado_por as someone else", async () => {
    const { error } = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Forjada",
        cor_avatar: "#111111",
        criado_por: member.id,
        criado_por_auditoria: member.id,
      });

    expectRlsDenied(error);
  });

  it("rejects an explicit attempt to insert is_editorial = false", async () => {
    const { error } = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Real Disfarçada",
        cor_avatar: "#222222",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
        is_editorial: false,
      });

    expectConstraintViolation(error);
  });

  it("rejects nome outside the valid length range", async () => {
    const empty = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .insert({
        nome: "   ",
        cor_avatar: "#333333",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      });
    const oversized = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .insert({
        nome: "x".repeat(121),
        cor_avatar: "#333333",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      });

    expectConstraintViolation(empty.error);
    expectConstraintViolation(oversized.error);
  });

  it("lets only an admin read personas (member/anon/non-member excluded)", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_personas_editoriais")
      .insert({
        nome: "Rotina de Terça",
        cor_avatar: "#444444",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;

    const asAdmin = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .select("id")
      .eq("id", seeded.data.id);
    const asMember = await redeClient(member.client)
      .from("rede_personas_editoriais")
      .select("id")
      .eq("id", seeded.data.id);
    const asAnon = await redeClient(anonClient())
      .from("rede_personas_editoriais")
      .select("id")
      .eq("id", seeded.data.id);

    expect(asAdmin.data).toEqual([{ id: seeded.data.id }]);
    expect(asMember.error).toBeNull();
    expect(asMember.data).toHaveLength(0);
    expectPermissionDenied(asAnon.error, "rede_personas_editoriais");
  });

  it("lets an admin edit editable fields and move ativa -> pausada -> arquivada", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Ciclo",
        cor_avatar: "#555555",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const personaId = seeded.data.id as string;

    const edited = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .update({ biografia: "Bio atualizada", cor_avatar: "#666666" })
      .eq("id", personaId)
      .select("biografia,cor_avatar");
    expect(edited.error).toBeNull();
    expect(edited.data).toEqual([
      { biografia: "Bio atualizada", cor_avatar: "#666666" },
    ]);

    const paused = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .update({ status: "pausada" })
      .eq("id", personaId)
      .select("status");
    expect(paused.error).toBeNull();
    expect(paused.data).toEqual([{ status: "pausada" }]);

    const resumed = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .update({ status: "ativa" })
      .eq("id", personaId)
      .select("status");
    expect(resumed.error).toBeNull();
    expect(resumed.data).toEqual([{ status: "ativa" }]);

    const archived = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .update({ status: "arquivada" })
      .eq("id", personaId)
      .select("status");
    expect(archived.error).toBeNull();
    expect(archived.data).toEqual([{ status: "arquivada" }]);
  });

  it("freezes a persona entirely once arquivada, including reactivation", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Congelada",
        cor_avatar: "#777777",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
        status: "arquivada",
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const personaId = seeded.data.id as string;

    const reactivate = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .update({ status: "ativa" })
      .eq("id", personaId);
    expectConstraintViolation(reactivate.error);

    const editAfterArchive = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .update({ biografia: "Não deveria colar" })
      .eq("id", personaId);
    expectConstraintViolation(editAfterArchive.error);
  });

  it("denies writing is_editorial, criado_em, or criado_por_auditoria via UPDATE", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Protegida",
        cor_avatar: "#888888",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const personaId = seeded.data.id as string;

    const isEditorial = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .update({ is_editorial: false })
      .eq("id", personaId);
    const criadoPorAuditoria = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .update({ criado_por_auditoria: member.id })
      .eq("id", personaId);

    expectPermissionDenied(isEditorial.error, "rede_personas_editoriais");
    expectPermissionDenied(
      criadoPorAuditoria.error,
      "rede_personas_editoriais"
    );
  });

  it("preserves criado_por_auditoria after the creating admin's account is deleted", async () => {
    const seeded = await redeClient(adminToDelete.client)
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Órfã",
        cor_avatar: "#999999",
        criado_por: adminToDelete.id,
        criado_por_auditoria: adminToDelete.id,
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const personaId = seeded.data.id as string;

    await deleteTestUser(adminToDelete);
    testUsers.splice(testUsers.indexOf(adminToDelete), 1);

    const after = await redeClient(adminClient())
      .from("rede_personas_editoriais")
      .select("criado_por,criado_por_auditoria")
      .eq("id", personaId)
      .single();
    expect(after.error).toBeNull();
    expect(after.data?.criado_por).toBeNull();
    expect(after.data?.criado_por_auditoria).toBe(adminToDelete.id);
  });

  it("does not grant persona deletion to authenticated users", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Indelével",
        cor_avatar: "#AAAAAA",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;

    const asAdmin = await redeClient(admin.client)
      .from("rede_personas_editoriais")
      .delete()
      .eq("id", seeded.data.id as string);

    expectPermissionDenied(asAdmin.error, "rede_personas_editoriais");
  });

  it("does not grant any anon access to personas", async () => {
    const anon = redeClient(anonClient());
    const select = await anon.from("rede_personas_editoriais").select("id");
    const insert = await anon.from("rede_personas_editoriais").insert({
      nome: "Persona Anônima",
      cor_avatar: "#BBBBBB",
      criado_por: admin.id,
      criado_por_auditoria: admin.id,
    });

    expectPermissionDenied(select.error, "rede_personas_editoriais");
    expectPermissionDenied(insert.error, "rede_personas_editoriais");
  });

  it("rejects a persona id used as a real user id in messaging, friendship, blocks, or reports", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_personas_editoriais")
      .insert({
        nome: "Persona Impostora",
        cor_avatar: "#CCCCCC",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      })
      .select("id")
      .single();
    if (seeded.error) throw seeded.error;
    const personaId = seeded.data.id as string;

    const friendRequest = await service.from("rede_amizades").insert({
      solicitante_id: personaId,
      destinatario_id: member.id,
    });
    const block = await service.from("rede_bloqueios").insert({
      bloqueador_id: personaId,
      bloqueado_id: member.id,
    });
    const report = await service.from("rede_denuncias").insert({
      denunciante_id: personaId,
      alvo_tipo: "usuario",
      alvo_id: member.id,
      motivo: "outro",
    });

    expectForeignKeyViolation(friendRequest.error);
    expectForeignKeyViolation(block.error);
    expectForeignKeyViolation(report.error);
  });

  describe("rede_personas_auditoria", () => {
    it("lets an admin write an audit row for their own action", async () => {
      const service = redeClient(adminClient());
      const seeded = await service
        .from("rede_personas_editoriais")
        .insert({
          nome: "Persona Auditada",
          cor_avatar: "#DDDDDD",
          criado_por: admin.id,
          criado_por_auditoria: admin.id,
        })
        .select("id")
        .single();
      if (seeded.error) throw seeded.error;

      const audited = await redeClient(admin.client)
        .from("rede_personas_auditoria")
        .insert({
          persona_id: seeded.data.id,
          admin_id: admin.id,
          admin_id_auditoria: admin.id,
          acao: "criada",
          conteudo: { nome: "Persona Auditada" },
        })
        .select("id,acao")
        .single();

      expect(audited.error).toBeNull();
      expect(audited.data?.acao).toBe("criada");
    });

    it("rejects an audit row forged with someone else's admin_id", async () => {
      const service = redeClient(adminClient());
      const seeded = await service
        .from("rede_personas_editoriais")
        .insert({
          nome: "Persona Auditada 2",
          cor_avatar: "#EEEEEE",
          criado_por: admin.id,
          criado_por_auditoria: admin.id,
        })
        .select("id")
        .single();
      if (seeded.error) throw seeded.error;

      const { error } = await redeClient(admin.client)
        .from("rede_personas_auditoria")
        .insert({
          persona_id: seeded.data.id,
          admin_id: member.id,
          admin_id_auditoria: member.id,
          acao: "editada",
        });

      expectRlsDenied(error);
    });

    it("rejects an audit row from a non-admin", async () => {
      const service = redeClient(adminClient());
      const seeded = await service
        .from("rede_personas_editoriais")
        .insert({
          nome: "Persona Auditada 3",
          cor_avatar: "#F0F0F0",
          criado_por: admin.id,
          criado_por_auditoria: admin.id,
        })
        .select("id")
        .single();
      if (seeded.error) throw seeded.error;

      const { error } = await redeClient(member.client)
        .from("rede_personas_auditoria")
        .insert({
          persona_id: seeded.data.id,
          admin_id: member.id,
          admin_id_auditoria: member.id,
          acao: "editada",
        });

      expectRlsDenied(error);
    });

    it("does not grant audit update or delete to any authenticated user", async () => {
      const service = redeClient(adminClient());
      const persona = await service
        .from("rede_personas_editoriais")
        .insert({
          nome: "Persona Auditada 4",
          cor_avatar: "#F1F1F1",
          criado_por: admin.id,
          criado_por_auditoria: admin.id,
        })
        .select("id")
        .single();
      if (persona.error) throw persona.error;
      const audit = await service
        .from("rede_personas_auditoria")
        .insert({
          persona_id: persona.data.id,
          admin_id: admin.id,
          admin_id_auditoria: admin.id,
          acao: "criada",
        })
        .select("id")
        .single();
      if (audit.error) throw audit.error;

      const update = await redeClient(admin.client)
        .from("rede_personas_auditoria")
        .update({ acao: "editada" })
        .eq("id", audit.data.id as string);
      const remove = await redeClient(admin.client)
        .from("rede_personas_auditoria")
        .delete()
        .eq("id", audit.data.id as string);

      expectPermissionDenied(update.error, "rede_personas_auditoria");
      expectPermissionDenied(remove.error, "rede_personas_auditoria");
    });

    it("does not grant any anon access to the audit trail", async () => {
      const anon = redeClient(anonClient());
      const select = await anon.from("rede_personas_auditoria").select("id");

      expectPermissionDenied(select.error, "rede_personas_auditoria");
    });

    it("prevents deleting a persona that still has audit history", async () => {
      const service = redeClient(adminClient());
      const persona = await service
        .from("rede_personas_editoriais")
        .insert({
          nome: "Persona Com Historico",
          cor_avatar: "#F2F2F2",
          criado_por: admin.id,
          criado_por_auditoria: admin.id,
        })
        .select("id")
        .single();
      if (persona.error) throw persona.error;
      const audit = await service.from("rede_personas_auditoria").insert({
        persona_id: persona.data.id,
        admin_id: admin.id,
        admin_id_auditoria: admin.id,
        acao: "criada",
      });
      if (audit.error) throw audit.error;

      const removal = await service
        .from("rede_personas_editoriais")
        .delete()
        .eq("id", persona.data.id as string);

      expect(removal.error).not.toBeNull();
      expect(removal.error?.code).toBe("23503");
    });
  });

  it("keeps service-role access for fixture and cleanup workflows", async () => {
    const service = redeClient(adminClient());
    const seeded = await service
      .from("rede_personas_editoriais")
      .insert({
        nome: randomUUID(),
        cor_avatar: "#F3F3F3",
        criado_por: admin.id,
        criado_por_auditoria: admin.id,
      })
      .select("id")
      .single();
    expect(seeded.error).toBeNull();

    const removal = await service
      .from("rede_personas_editoriais")
      .delete()
      .eq("id", seeded.data?.id as string)
      .select("id");
    expect(removal.error).toBeNull();
    expect(removal.data).toEqual([{ id: seeded.data?.id }]);
  });
});
