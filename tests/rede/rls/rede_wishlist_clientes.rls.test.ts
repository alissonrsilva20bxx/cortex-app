import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * Issue #64: WishlistScreen/ClientesScreen eram só `useState` local desde a
 * rodada corretiva de T12 ("Demonstração — sem tabela real"). Migration
 * 0021 adiciona rede_wishlist_items/rede_clientes, ambas 100% privadas ao
 * dono (sem "member select" -- nenhuma tela expõe essas listas de
 * terceiros hoje, e Clientes é explicitamente "área privada" na UI).
 */

function redeClient(client: TestClient): SupabaseClient {
  return client as SupabaseClient;
}

function expectPermissionDenied(
  error: { code?: string; message: string } | null,
  table: string
): void {
  expect(error).not.toBeNull();
  expect(error?.code).toBe("42501");
  expect(error?.message).toContain(`permission denied for table ${table}`);
}

describe("RLS: rede_wishlist_items / rede_clientes", () => {
  const testUsers: TestUser[] = [];
  let owner: TestUser;
  let outsider: TestUser;
  let nonMember: TestUser;

  beforeAll(async () => {
    owner = await createTestUser();
    testUsers.push(owner);
    outsider = await createTestUser();
    testUsers.push(outsider);
    nonMember = await createTestUser();
    testUsers.push(nonMember);

    const service = redeClient(adminClient());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    for (const user of [owner, outsider]) {
      const { error: membershipError } = await service
        .from("rede_convites")
        .insert({
          codigo_hash: `wishlist-clientes-${user.id}`,
          usado_por: user.id,
          usado_em: now,
          expira_em: expiresAt,
        });
      if (membershipError) {
        throw new Error(
          `Failed to seed membership: ${membershipError.message}`
        );
      }
      const { error: profileError } = await service.from("rede_perfis").insert({
        user_id: user.id,
        nome_exibicao: `Wishlist test ${user.id.slice(0, 8)}`,
        cor_avatar: "#123456",
      });
      if (profileError) {
        throw new Error(`Failed to seed profile: ${profileError.message}`);
      }
    }
    // nonMember nunca resgata convite nem tem perfil -- usado só pra provar
    // que a policy de insert exige rede_is_member(), não só auth.uid() = user_id.
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  describe("rede_wishlist_items", () => {
    it("lets the owner create, read, update and delete their own item", async () => {
      const client = redeClient(owner.client);
      const { data: created, error: insertError } = await client
        .from("rede_wishlist_items")
        .insert({
          user_id: owner.id,
          nome: "Cadeira hidráulica",
          cor: "#FF7AB6",
          valor_alvo: 1200,
        })
        .select()
        .single();
      expect(insertError).toBeNull();
      expect((created as { estado: string }).estado).toBe("quero");
      expect((created as { valor_atual: number }).valor_atual).toBe(0);

      const itemId = (created as { id: string }).id;

      const { error: updateError } = await client
        .from("rede_wishlist_items")
        .update({ valor_atual: 300, estado: "planejando" })
        .eq("id", itemId);
      expect(updateError).toBeNull();

      const { data: read, error: readError } = await client
        .from("rede_wishlist_items")
        .select("valor_atual,estado")
        .eq("id", itemId)
        .single();
      expect(readError).toBeNull();
      expect(read).toEqual({ valor_atual: 300, estado: "planejando" });

      const { error: deleteError } = await client
        .from("rede_wishlist_items")
        .delete()
        .eq("id", itemId);
      expect(deleteError).toBeNull();
    });

    it("rejects a negative valor_alvo", async () => {
      const { error } = await redeClient(owner.client)
        .from("rede_wishlist_items")
        .insert({
          user_id: owner.id,
          nome: "Item inválido",
          cor: "#FF7AB6",
          valor_alvo: -1,
        });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514");
    });

    it("hides another user's wishlist entirely (no member-select)", async () => {
      const { data: created } = await redeClient(owner.client)
        .from("rede_wishlist_items")
        .insert({
          user_id: owner.id,
          nome: "Privado do dono",
          cor: "#FF7AB6",
          valor_alvo: 500,
          privacidade: "comunidade",
        })
        .select("id")
        .single();

      const { data, error } = await redeClient(outsider.client)
        .from("rede_wishlist_items")
        .select("id")
        .eq("id", (created as { id: string }).id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("rejects insert for another user's id, and insert without Rede membership", async () => {
      const forOther = await redeClient(outsider.client)
        .from("rede_wishlist_items")
        .insert({
          user_id: owner.id,
          nome: "Tentativa alheia",
          cor: "#FF7AB6",
          valor_alvo: 100,
        });
      expect(forOther.error).not.toBeNull();
      expect(forOther.error?.code).toBe("42501");

      const withoutMembership = await redeClient(nonMember.client)
        .from("rede_wishlist_items")
        .insert({
          user_id: nonMember.id,
          nome: "Sem convite",
          cor: "#FF7AB6",
          valor_alvo: 100,
        });
      expect(withoutMembership.error).not.toBeNull();
      expect(withoutMembership.error?.code).toBe("42501");
    });

    it("denies anon entirely", async () => {
      const anon = redeClient(anonClient());
      const select = await anon.from("rede_wishlist_items").select("id");
      const insert = await anon.from("rede_wishlist_items").insert({
        user_id: outsider.id,
        nome: "Anon",
        cor: "#FF7AB6",
        valor_alvo: 100,
      });
      expectPermissionDenied(select.error, "rede_wishlist_items");
      expectPermissionDenied(insert.error, "rede_wishlist_items");
    });
  });

  describe("rede_clientes", () => {
    it("lets the owner create, read, update and delete their own cliente", async () => {
      const client = redeClient(owner.client);
      const { data: created, error: insertError } = await client
        .from("rede_clientes")
        .insert({ user_id: owner.id, nome: "Camila", telefone: "11999990000" })
        .select()
        .single();
      expect(insertError).toBeNull();
      expect((created as { status: string }).status).toBe("ativo");
      expect((created as { etiquetas: string[] }).etiquetas).toEqual([]);

      const clienteId = (created as { id: string }).id;

      const { error: updateError } = await client
        .from("rede_clientes")
        .update({ status: "vip", etiquetas: ["fidelizada"] })
        .eq("id", clienteId);
      expect(updateError).toBeNull();

      const { error: deleteError } = await client
        .from("rede_clientes")
        .delete()
        .eq("id", clienteId);
      expect(deleteError).toBeNull();
    });

    it("never reveals a cliente to anyone but its owner, not even another member", async () => {
      const { data: created } = await redeClient(owner.client)
        .from("rede_clientes")
        .insert({ user_id: owner.id, nome: "Confidencial" })
        .select("id")
        .single();

      const { data, error } = await redeClient(outsider.client)
        .from("rede_clientes")
        .select("id")
        .eq("id", (created as { id: string }).id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("rejects insert for another user's id, and insert without Rede membership", async () => {
      const forOther = await redeClient(outsider.client)
        .from("rede_clientes")
        .insert({ user_id: owner.id, nome: "Tentativa alheia" });
      expect(forOther.error).not.toBeNull();
      expect(forOther.error?.code).toBe("42501");

      const withoutMembership = await redeClient(nonMember.client)
        .from("rede_clientes")
        .insert({ user_id: nonMember.id, nome: "Sem convite" });
      expect(withoutMembership.error).not.toBeNull();
      expect(withoutMembership.error?.code).toBe("42501");
    });

    it("denies anon entirely", async () => {
      const anon = redeClient(anonClient());
      const select = await anon.from("rede_clientes").select("id");
      const insert = await anon
        .from("rede_clientes")
        .insert({ user_id: outsider.id, nome: "Anon" });
      expectPermissionDenied(select.error, "rede_clientes");
      expectPermissionDenied(insert.error, "rede_clientes");
    });
  });
});
