import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  listarClientes,
} from "../../../lib/rede/clientes";
import {
  atualizarWishlistItem,
  criarWishlistItem,
  excluirWishlistItem,
  listarWishlistItems,
} from "../../../lib/rede/wishlist";
import { adminClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/** Issue #64: persistência real de Wishlist/Clientes, antes só mock local. */
describe("serviços de Wishlist e Clientes com Supabase local", () => {
  let owner: TestUser;
  let otherOwner: TestUser;

  async function seedMemberWithProfile(user: TestUser): Promise<void> {
    const admin = adminClient();
    const invite = await admin.from("rede_convites").insert({
      codigo_hash: randomUUID(),
      usado_por: user.id,
      usado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + 86_400_000).toISOString(),
    });
    if (invite.error) throw invite.error;

    const profile = await admin.from("rede_perfis").insert({
      user_id: user.id,
      nome_exibicao: "Teste Wishlist/Clientes",
      cor_avatar: "#123456",
    });
    if (profile.error) throw profile.error;
  }

  beforeAll(async () => {
    owner = await createTestUser();
    otherOwner = await createTestUser();
    await seedMemberWithProfile(owner);
    await seedMemberWithProfile(otherOwner);
  });

  afterAll(async () => {
    const results = await Promise.allSettled([
      deleteTestUser(owner),
      deleteTestUser(otherOwner),
    ]);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(
        `Falha ao remover ${failures.length} usuário(s) local(is) de teste`
      );
    }
  });

  describe("wishlist", () => {
    it("cria, lista, atualiza e exclui um item, isolado por dono", async () => {
      const created = await criarWishlistItem(owner.client, {
        nome: "Cadeira hidráulica",
        cor: "#FF7AB6",
        valorAlvo: 1200,
      });
      expect(created.estado).toBe("quero");
      expect(created.privacidade).toBe("privado");
      expect(created.valorAtual).toBe(0);

      await criarWishlistItem(otherOwner.client, {
        nome: "Item de outra dona",
        cor: "#7AA7FF",
        valorAlvo: 500,
      });

      const ownerItems = await listarWishlistItems(owner.client, owner.id);
      expect(ownerItems.map((i) => i.id)).toEqual([created.id]);

      const updated = await atualizarWishlistItem(owner.client, {
        itemId: created.id,
        nome: "Cadeira hidráulica premium",
        valorAlvo: 1500,
        valorAtual: 400,
        estado: "planejando",
        privacidade: "comunidade",
      });
      expect(updated.nome).toBe("Cadeira hidráulica premium");
      expect(updated.valorAtual).toBe(400);
      expect(updated.estado).toBe("planejando");

      await excluirWishlistItem(owner.client, { itemId: created.id });
      expect(await listarWishlistItems(owner.client, owner.id)).toEqual([]);
    });

    it("não deixa atualizar/excluir item de outra dona", async () => {
      const foreign = await criarWishlistItem(otherOwner.client, {
        nome: "Alheio",
        cor: "#7AA7FF",
        valorAlvo: 100,
      });

      await expect(
        atualizarWishlistItem(owner.client, {
          itemId: foreign.id,
          nome: "Invasão",
          valorAlvo: 1,
          valorAtual: 0,
          estado: "quero",
          privacidade: "privado",
        })
      ).rejects.toThrow();

      const stillIntact = await listarWishlistItems(
        otherOwner.client,
        otherOwner.id
      );
      expect(stillIntact.find((i) => i.id === foreign.id)?.nome).toBe("Alheio");
    });
  });

  describe("clientes", () => {
    it("cria, lista, atualiza e exclui um cliente, isolado por dono", async () => {
      const created = await criarCliente(owner.client, {
        nome: "Camila",
        telefone: "11999990000",
      });
      expect(created.status).toBe("ativo");
      expect(created.etiquetas).toEqual([]);

      await criarCliente(otherOwner.client, { nome: "Cliente de outra dona" });

      const ownerClientes = await listarClientes(owner.client, owner.id);
      expect(ownerClientes.map((c) => c.id)).toEqual([created.id]);

      const updated = await atualizarCliente(owner.client, {
        clienteId: created.id,
        nome: "Camila Duarte",
        telefone: "11999990000",
        status: "vip",
        etiquetas: ["fidelizada", "indicação"],
        observacoes: "Sempre pontual.",
      });
      expect(updated.status).toBe("vip");
      expect(updated.etiquetas).toEqual(["fidelizada", "indicação"]);

      await excluirCliente(owner.client, { clienteId: created.id });
      expect(await listarClientes(owner.client, owner.id)).toEqual([]);
    });

    it("não deixa atualizar/excluir cliente de outra dona", async () => {
      const foreign = await criarCliente(otherOwner.client, {
        nome: "Confidencial",
      });

      await expect(
        atualizarCliente(owner.client, {
          clienteId: foreign.id,
          nome: "Invasão",
          telefone: "",
          status: "pausado",
          etiquetas: [],
          observacoes: "",
        })
      ).rejects.toThrow();

      const stillIntact = await listarClientes(
        otherOwner.client,
        otherOwner.id
      );
      expect(stillIntact.find((c) => c.id === foreign.id)?.nome).toBe(
        "Confidencial"
      );
    });
  });
});
