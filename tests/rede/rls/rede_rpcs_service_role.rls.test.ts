import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, type TestClient } from "../support/clients";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/testUsers";

function redeClient(client: TestClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

/**
 * Migrations 0028 / 0029 / 0031 / 0032 -- as três RPCs abaixo comandam a
 * fila de exclusão de mídia e o trigger de retenção (operações
 * destrutivas / de manutenção). São expostas via PostgREST no schema
 * `public`, então PRECISAM ser inacessíveis a `anon` e `authenticated` --
 * só o client admin (service_role), usado pela rota de cron, pode chamá-las.
 *
 * `revoke ... from public` sozinho NÃO garante isso no Supabase: o
 * `alter default privileges` do projeto concede `execute` a
 * `anon`/`authenticated` explicitamente em toda função nova de `public`.
 * As migrations revogam desses dois papéis de propósito; este teste é o
 * guarda de regressão.
 */
describe("RLS: RPCs de fila/retenção da Rede são service_role only", () => {
  const testUsers: TestUser[] = [];

  afterAll(async () => {
    for (const user of testUsers) {
      await deleteTestUser(user);
    }
  });

  const rpcs = [
    {
      name: "rede_posts_retencao_definir_habilitada",
      args: { habilitada: false },
    },
    { name: "rede_midia_drenar_pendentes", args: { lote: 0 } },
    { name: "rede_midia_reenfileirar_pendentes", args: { paths: [] } },
  ] as const;

  for (const rpc of rpcs) {
    it(`${rpc.name}: nega anon`, async () => {
      const { error } = await redeClient(anonClient()).rpc(rpc.name, rpc.args);
      expect(error?.code).toBe("42501");
    });

    it(`${rpc.name}: nega um usuário autenticado comum`, async () => {
      const user = await createTestUser();
      testUsers.push(user);
      const { error } = await redeClient(user.client).rpc(rpc.name, rpc.args);
      expect(error?.code).toBe("42501");
    });

    it(`${rpc.name}: permite service_role`, async () => {
      const { error } = await redeClient(adminClient()).rpc(rpc.name, rpc.args);
      expect(error).toBeNull();
    });
  }
});
