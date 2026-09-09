import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

function redeClient(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

/**
 * Migration 0028/0030 -- o teste sequencial (rede_posts_retencao.rls.test.ts)
 * prova que o 301o post, sozinho, apaga o mais antigo. Mas cada trigger
 * roda dentro da SUA PRÓPRIA transação (READ COMMITTED): se N inserts
 * concorrentes cruzam os 300 ao mesmo tempo, cada trigger só enxerga
 * commits que já terminaram antes DELE começar -- não os das outras N-1
 * transações ainda em voo. Sem um lock, várias delas podem calcular
 * "só preciso apagar 1" a partir do mesmo snapshot de 300 baseline,
 * mirando na MESMA linha mais antiga -- as demais viram no-op (a linha já
 * sumiu), e o excedente de verdade nunca é apagado. Este teste prova que
 * isso NÃO acontece (migration 0030 serializa com pg_advisory_xact_lock).
 */
describe("Concorrência: retenção de 300 posts sob inserts simultâneos", () => {
  const testUsers: TestUser[] = [];
  let autor: TestUser;

  beforeAll(async () => {
    autor = await createTestUser();
    testUsers.push(autor);

    const admin = redeClient(adminClient());
    const { error: convError } = await admin.from("rede_convites").insert({
      codigo_hash: `rd28-concorrencia-${autor.id}`,
      usado_por: autor.id,
      usado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (convError) {
      throw new Error(`Failed to seed Rede membership: ${convError.message}`);
    }

    const { error: cleanupError } = await admin
      .from("rede_posts")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (cleanupError) {
      throw new Error(`Failed to reset rede_posts: ${cleanupError.message}`);
    }

    // Migration 0028/0031: o trigger nasce DESATIVADO por padrão -- este
    // teste existe pra provar o comportamento sob concorrência, então
    // liga ele deliberada e explicitamente só pro escopo deste describe.
    const { error: enableError } = await admin.rpc(
      "rede_posts_retencao_definir_habilitada",
      { habilitada: true }
    );
    if (enableError) {
      throw new Error(
        `Failed to enable rede_posts_retention trigger: ${enableError.message}`
      );
    }
  }, 30_000);

  afterAll(async () => {
    const admin = redeClient(adminClient());
    // Restaura o padrão desativado -- não deixar o trigger ligado pra
    // outros arquivos de teste que rodem depois contra o mesmo Supabase
    // local.
    await admin.rpc("rede_posts_retencao_definir_habilitada", {
      habilitada: false,
    });

    const failures: unknown[] = [];
    for (const user of testUsers) {
      try {
        await deleteTestUser(user);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} local test user(s)`);
    }
  });

  it("never exceeds 300 posts even when many inserts cross the cap at the same time", async () => {
    const admin = redeClient(adminClient());
    const base = Date.now();

    const antigos = Array.from({ length: 295 }, (_, i) => ({
      autor_id: autor.id,
      categoria: "dica" as const,
      texto: `post antigo #${i}`,
      criado_em: new Date(base - (295 - i) * 1000).toISOString(),
    }));
    const seeded = await admin.from("rede_posts").insert(antigos);
    expect(seeded.error).toBeNull();

    // 20 inserts verdadeiramente concorrentes (Promise.all, uma transação
    // cada) -- 295 + 20 = 315, 15 precisam ser apagados no total pra
    // convergir em 300.
    const concorrentes = Array.from({ length: 20 }, (_, i) =>
      admin.from("rede_posts").insert({
        autor_id: autor.id,
        categoria: "dica",
        texto: `post concorrente #${i}`,
        criado_em: new Date(base + i).toISOString(),
      })
    );
    const results = await Promise.all(concorrentes);
    expect(results.every((r) => r.error === null)).toBe(true);

    const after = await admin
      .from("rede_posts")
      .select("id", { count: "exact", head: true });
    expect(after.count).toBe(300);
  }, 30_000);
});
