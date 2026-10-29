import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

// Migration 0049: entra na Rede quem está no teste grátis, quem assina ou
// quem já usou um convite (N4). Só passa num banco com a 0040 e a 0049
// aplicadas (homolog). O mesmo comportamento é conferido sem banco em
// tests/rede/acesso-0049-pglite.mjs.

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

describe("RLS: 0049 entrada na Rede pelo teste ou pela assinatura", () => {
  const users: TestUser[] = [];
  const conviteHash = `r19-convite-${randomUUID()}`;
  let noTeste: TestUser;
  let outraNoTeste: TestUser;
  let testeAcabou: TestUser;
  let comConvite: TestUser;
  let assinante: TestUser;

  beforeAll(async () => {
    noTeste = await createTestUser({ teste: "ativo" });
    users.push(noTeste);
    outraNoTeste = await createTestUser({ teste: "ativo" });
    users.push(outraNoTeste);
    testeAcabou = await createTestUser();
    users.push(testeAcabou);
    comConvite = await createTestUser();
    users.push(comConvite);
    assinante = await createTestUser();
    users.push(assinante);

    const service = adminClient();
    const convite = await redeClient(service)
      .from("rede_convites")
      .insert({
        codigo_hash: conviteHash,
        usado_por: comConvite.id,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (convite.error) {
      throw new Error(`Failed to seed invite: ${convite.error.message}`);
    }
    const assinatura = await service
      .from("configuracoes")
      .update({ assinatura_status: "ativa" })
      .eq("user_id", assinante.id);
    if (assinatura.error) {
      throw new Error(
        `Failed to seed subscription: ${assinatura.error.message}`
      );
    }
  });

  afterAll(async () => {
    await redeClient(adminClient())
      .from("rede_convites")
      .delete()
      .eq("codigo_hash", conviteHash);
    await Promise.allSettled(users.map(deleteTestUser));
  });

  async function estaNaRede(user: TestUser): Promise<unknown> {
    const { data, error } = await redeClient(user.client).rpc("rede_is_member");
    expect(error).toBeNull();
    return data;
  }

  it("conta nova no teste está na Rede, sem convite", async () => {
    expect(await estaNaRede(noTeste)).toBe(true);
  });

  it("teste acabou e sem assinatura: fora da Rede", async () => {
    expect(await estaNaRede(testeAcabou)).toBe(false);
  });

  it("convite antigo segue entrando depois do teste (N4)", async () => {
    expect(await estaNaRede(comConvite)).toBe(true);
  });

  it("assinatura ativa entra depois do teste", async () => {
    expect(await estaNaRede(assinante)).toBe(true);
  });

  it("no teste publica e outra no teste lê o post", async () => {
    const texto = `r19 ${randomUUID()}`;
    const insert = await redeClient(noTeste.client)
      .from("rede_posts")
      .insert({ autor_id: noTeste.id, categoria: "dica", texto });
    expect(insert.error).toBeNull();

    const lido = await redeClient(outraNoTeste.client)
      .from("rede_posts")
      .select("texto")
      .eq("texto", texto);
    expect(lido.error).toBeNull();
    expect(lido.data).toHaveLength(1);

    const fora = await redeClient(testeAcabou.client)
      .from("rede_posts")
      .select("texto")
      .eq("texto", texto);
    expect(fora.error).toBeNull();
    expect(fora.data).toHaveLength(0);
  });

  it("teste acabou: não publica", async () => {
    const { error } = await redeClient(testeAcabou.client)
      .from("rede_posts")
      .insert({ autor_id: testeAcabou.id, categoria: "dica", texto: "r19" });
    expect(error).not.toBeNull();
  });

  it("N1: duas pessoas no teste, sem convite, abrem conversa", async () => {
    const { data, error } = await redeClient(noTeste.client).rpc(
      "rede_criar_conversa_1a1",
      { outro_user_id: outraNoTeste.id }
    );
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
  });

  it("N1: não abre conversa com quem saiu da Rede", async () => {
    const { error } = await redeClient(noTeste.client).rpc(
      "rede_criar_conversa_1a1",
      { outro_user_id: testeAcabou.id }
    );
    expect(error).not.toBeNull();
  });

  it("a própria conta não estica o teste nem se dá a assinatura (0040)", async () => {
    await redeClient(testeAcabou.client)
      .from("configuracoes")
      .update({
        trial_started_at: new Date().toISOString(),
        assinatura_status: "ativa",
      })
      .eq("user_id", testeAcabou.id);
    expect(await estaNaRede(testeAcabou)).toBe(false);
  });

  it("código não é mais resgatável pela sessão", async () => {
    const { error } = await redeClient(testeAcabou.client).rpc(
      "rede_resgatar_convite",
      { codigo_hash: `r19-${randomUUID()}`, ip_hash: "r19" }
    );
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});
