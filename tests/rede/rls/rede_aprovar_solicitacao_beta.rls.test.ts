import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Issue #89: quem solicita a beta (rede_solicitacoes_beta) já está
 * autenticada, então não faz sentido gerar um código pra ela mesma
 * digitar de volta. Migration 0020 adiciona `rede_aprovar_solicitacao_beta`
 * -- só admin, aprova uma solicitação pendente liberando acesso direto
 * (insere em rede_convites já resgatado pro user_id certo), sem nenhum
 * texto puro de código envolvido.
 */

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

describe("RLS: rede_aprovar_solicitacao_beta", () => {
  const testUsers: TestUser[] = [];
  let admin: TestUser;
  let solicitante: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    admin = await createTestUser();
    testUsers.push(admin);
    solicitante = await createTestUser();
    testUsers.push(solicitante);
    outsider = await createTestUser();
    testUsers.push(outsider);

    const service = redeClient(adminClient());
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

  async function seedSolicitacaoPendente(user: TestUser): Promise<string> {
    const { data, error } = await redeClient(user.client)
      .from("rede_solicitacoes_beta")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Failed to seed pending solicitação: ${error?.message}`);
    }
    return (data as { id: string }).id;
  }

  it("lets an admin approve a pending request, granting direct access with no code", async () => {
    const solicitacaoId = await seedSolicitacaoPendente(solicitante);

    const { data, error } = await redeClient(admin.client).rpc(
      "rede_aprovar_solicitacao_beta",
      { solicitacao_id: solicitacaoId }
    );
    expect(error).toBeNull();
    expect((data as { user_id: string }).user_id).toBe(solicitante.id);

    const { data: statusRow, error: statusError } = await redeClient(
      solicitante.client
    )
      .from("rede_solicitacoes_beta")
      .select("status")
      .eq("id", solicitacaoId)
      .single();
    expect(statusError).toBeNull();
    expect((statusRow as { status: string }).status).toBe("convidado");

    // Mesma consulta que lib/rede/acesso.ts usa pra decidir acesso
    // liberado -- confirma que o desbloqueio acontece sem nenhum código.
    const { data: convite, error: conviteError } = await redeClient(
      solicitante.client
    )
      .from("rede_convites")
      .select("id")
      .eq("usado_por", solicitante.id)
      .limit(1);
    expect(conviteError).toBeNull();
    expect(convite).toHaveLength(1);
  });

  it("rejects a non-admin trying to approve, even their own request", async () => {
    const solicitacaoId = await seedSolicitacaoPendente(outsider);

    const { error } = await redeClient(outsider.client).rpc(
      "rede_aprovar_solicitacao_beta",
      { solicitacao_id: solicitacaoId }
    );
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    const { data: statusRow } = await redeClient(adminClient())
      .from("rede_solicitacoes_beta")
      .select("status")
      .eq("id", solicitacaoId)
      .single();
    expect((statusRow as { status: string }).status).toBe("pendente");
  });

  it("rejects anon entirely (no execute grant)", async () => {
    const anon = redeClient(anonClient());
    const { error } = await anon.rpc("rede_aprovar_solicitacao_beta", {
      solicitacao_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("rejects approving an already-processed request without duplicating rede_convites", async () => {
    const solicitante2 = await createTestUser();
    testUsers.push(solicitante2);
    const solicitacaoId = await seedSolicitacaoPendente(solicitante2);

    const first = await redeClient(admin.client).rpc(
      "rede_aprovar_solicitacao_beta",
      { solicitacao_id: solicitacaoId }
    );
    expect(first.error).toBeNull();

    const second = await redeClient(admin.client).rpc(
      "rede_aprovar_solicitacao_beta",
      { solicitacao_id: solicitacaoId }
    );
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("22023");

    const { data: convites, error: convitesError } = await redeClient(
      adminClient()
    )
      .from("rede_convites")
      .select("id")
      .eq("solicitacao_id", solicitacaoId);
    expect(convitesError).toBeNull();
    expect(convites).toHaveLength(1);
  });

  it("rejects approving a solicitação that does not exist", async () => {
    const { error } = await redeClient(admin.client).rpc(
      "rede_aprovar_solicitacao_beta",
      { solicitacao_id: "00000000-0000-0000-0000-000000000000" }
    );
    expect(error).not.toBeNull();
    expect(error?.code).toBe("P0002");
  });
});
