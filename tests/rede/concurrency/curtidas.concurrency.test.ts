import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { alternarCurtida, criarPost } from "../../../lib/rede/feed";
import { adminClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

/**
 * RD-19: curtida disparada em paralelo pelo mesmo usuário no mesmo post.
 * lib/rede/feed.ts#alternarCurtida faz leitura-então-escrita (não é uma
 * transação atômica única) — quem segura a corrida é a PK composta
 * (post_id, user_id) em rede_curtidas combinada com o upsert
 * `ignoreDuplicates` no branch de inserção. Este teste prova, contra
 * Postgres real, que disparar o toggle N vezes em paralelo a partir do
 * estado "não curtido" nunca produz mais de uma linha nem erro para quem
 * chamou.
 *
 * Instabilidade conhecida (não mascarada): o primeiro `it` abaixo falha de
 * forma intermitente porque `alternarCurtida` lê e decide antes de
 * escrever em duas transações HTTP separadas -- é uma corrida real na
 * aplicação, não flakiness de infraestrutura. Causa raiz documentada em
 * docs/rede/RD19_EVIDENCE.md §6; não corrigido nesta rodada (fora do
 * escopo desta revisão).
 */
describe("RD-19 concorrência: rede_curtidas", () => {
  const testUsers: TestUser[] = [];
  let autor: TestUser;

  async function seedMembership(userId: string): Promise<void> {
    const { error } = await adminClient()
      .from("rede_convites")
      .insert({
        codigo_hash: `rd19-curtida-member-${userId}`,
        usado_por: userId,
        usado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    if (error) {
      throw new Error(`Failed to seed Rede membership: ${error.message}`);
    }
  }

  async function contarCurtidas(postId: string): Promise<number> {
    const { count, error } = await adminClient()
      .from("rede_curtidas")
      .select("post_id", { count: "exact", head: true })
      .eq("post_id", postId);
    if (error) {
      throw new Error(`Failed to count likes: ${error.message}`);
    }
    return count ?? 0;
  }

  beforeAll(async () => {
    autor = await createTestUser();
    testUsers.push(autor);
    await seedMembership(autor.id);
  });

  afterAll(async () => {
    const cleanup = await Promise.allSettled(testUsers.map(deleteTestUser));
    const failures = cleanup.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("keeps exactly one like row when the same user toggles the same post in parallel", async () => {
    const liker = await createTestUser();
    testUsers.push(liker);
    await seedMembership(liker.id);

    const post = await criarPost(autor.client, {
      categoria: "dica",
      texto: "post para o teste de concorrência de curtidas",
    });

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        alternarCurtida(liker.client, { postId: post.id })
      )
    );

    const rejected = attempts.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(0);
    expect(await contarCurtidas(post.id)).toBe(1);
  });

  it("keeps the row count consistent across independent concurrent likers", async () => {
    const likers: TestUser[] = [];
    for (let index = 0; index < 4; index += 1) {
      const liker = await createTestUser();
      testUsers.push(liker);
      likers.push(liker);
      await seedMembership(liker.id);
    }

    const post = await criarPost(autor.client, {
      categoria: "conquista",
      texto: "post curtido por múltiplos usuários ao mesmo tempo",
    });

    const attempts = await Promise.allSettled(
      likers.map((liker) => alternarCurtida(liker.client, { postId: post.id }))
    );

    const rejected = attempts.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(0);
    expect(await contarCurtidas(post.id)).toBe(likers.length);
  });
});
