import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  criarLiveLink,
  excluirLiveLink,
  reordenarLiveLinks,
} from "../../../lib/rede/perfis";
import {
  adminClient,
  anonClient,
  authenticatedClient,
} from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

describe("serviço de LiveLinks com Supabase local", () => {
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
      nome_exibicao: "Teste LiveLinks",
      cor_avatar: "#123456",
    });
    if (profile.error) throw profile.error;
  }

  async function currentOrder(userId: string): Promise<string[]> {
    const { data, error } = await adminClient()
      .from("rede_livelinks")
      .select("id")
      .eq("user_id", userId)
      .order("ordem", { ascending: true });
    if (error) throw error;
    return data.map(({ id }) => id);
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

  it("reordena atomicamente o conjunto completo do proprietário", async () => {
    const first = await criarLiveLink(owner.client, {
      titulo: "Primeiro",
      url: "https://example.test/primeiro",
      ordem: 0,
    });
    const second = await criarLiveLink(owner.client, {
      titulo: "Segundo",
      url: "https://example.test/segundo",
      ordem: 1,
    });
    const third = await criarLiveLink(owner.client, {
      titulo: "Terceiro",
      url: "https://example.test/terceiro",
      ordem: 2,
    });

    const reordered = await reordenarLiveLinks(owner.client, {
      ids: [third.id, first.id, second.id],
    });

    expect(reordered.map(({ id }) => id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    await expect(currentOrder(owner.id)).resolves.toEqual([
      third.id,
      first.id,
      second.id,
    ]);
  });

  it.each([
    ["IDs duplicados", (ids: string[]) => [ids[0], ids[0], ids[2]]],
    ["conjunto incompleto", (ids: string[]) => ids.slice(0, 2)],
  ])("recusa %s sem alteração parcial", async (_case, invalidIds) => {
    const before = await currentOrder(owner.id);

    await expect(
      reordenarLiveLinks(owner.client, { ids: invalidIds(before) })
    ).rejects.toBeTruthy();

    await expect(currentOrder(owner.id)).resolves.toEqual(before);
  });

  it("recusa ID de outro proprietário sem alteração parcial", async () => {
    const foreign = await criarLiveLink(otherOwner.client, {
      titulo: "Alheio",
      url: "https://example.test/alheio",
      ordem: 0,
    });
    const before = await currentOrder(owner.id);

    await expect(
      reordenarLiveLinks(owner.client, {
        ids: [before[1], foreign.id, before[0]],
      })
    ).rejects.toBeTruthy();

    await expect(currentOrder(owner.id)).resolves.toEqual(before);
    await expect(currentOrder(otherOwner.id)).resolves.toEqual([foreign.id]);
  });

  it("recusa chamada sem autenticação", async () => {
    const { error } = await anonClient().rpc("rede_reordenar_livelinks", {
      livelink_ids: [],
    });

    expect(error).not.toBeNull();
  });

  it("serializa reordenações concorrentes sem produzir ordem parcial", async () => {
    const initial = await currentOrder(owner.id);
    const permutationA = [initial[2], initial[0], initial[1]];
    const permutationB = [initial[1], initial[2], initial[0]];

    await Promise.all([
      reordenarLiveLinks(owner.client, { ids: permutationA }),
      reordenarLiveLinks(owner.client, { ids: permutationB }),
    ]);

    const finalOrder = await currentOrder(owner.id);
    expect([permutationA, permutationB]).toContainEqual(finalOrder);
  });

  it("serializa reordenação concorrente com criação", async () => {
    const secondSession = await authenticatedClient(
      owner.email,
      owner.password
    );
    const before = await currentOrder(owner.id);
    const permutation = [...before].reverse();

    const [reorderResult, createResult] = await Promise.allSettled([
      reordenarLiveLinks(owner.client, { ids: permutation }),
      criarLiveLink(secondSession, {
        titulo: "Criado em concorrência",
        url: "https://example.test/concorrente",
        ordem: before.length,
      }),
    ]);

    expect(createResult.status).toBe("fulfilled");
    if (reorderResult.status === "fulfilled") {
      expect(reorderResult.value.map(({ id }) => id)).toEqual(permutation);
    } else {
      expect((reorderResult.reason as { code?: string }).code).toBe("22023");
    }
    const createdId =
      createResult.status === "fulfilled" ? createResult.value.id : "";
    const finalIds = await currentOrder(owner.id);
    expect(finalIds).toHaveLength(before.length + 1);
    expect(finalIds).toEqual(expect.arrayContaining([...before, createdId]));
  });

  it("serializa reordenação concorrente com exclusão", async () => {
    const secondSession = await authenticatedClient(
      otherOwner.email,
      otherOwner.password
    );
    const extraA = await criarLiveLink(otherOwner.client, {
      titulo: "Extra A",
      url: "https://example.test/extra-a",
      ordem: 1,
    });
    const extraB = await criarLiveLink(otherOwner.client, {
      titulo: "Extra B",
      url: "https://example.test/extra-b",
      ordem: 2,
    });
    const before = await currentOrder(otherOwner.id);
    const permutation = [extraB.id, before[0], extraA.id];

    const [reorderResult, deleteResult] = await Promise.allSettled([
      reordenarLiveLinks(otherOwner.client, { ids: permutation }),
      excluirLiveLink(secondSession, { livelinkId: extraA.id }),
    ]);

    expect(deleteResult.status).toBe("fulfilled");
    if (reorderResult.status === "fulfilled") {
      expect(reorderResult.value.map(({ id }) => id)).toEqual(permutation);
    } else {
      expect((reorderResult.reason as { code?: string }).code).toBe("22023");
    }
    const finalIds = await currentOrder(otherOwner.id);
    expect(finalIds).toHaveLength(before.length - 1);
    expect(finalIds).not.toContain(extraA.id);
    expect(finalIds).toEqual(
      expect.arrayContaining(before.filter((id) => id !== extraA.id))
    );
  });
});
