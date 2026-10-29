import { randomUUID } from "node:crypto";
import { adminClient, authenticatedClient, type TestClient } from "./clients";

export type TestUser = {
  id: string;
  email: string;
  password: string;
  client: TestClient;
};

/**
 * Creates a disposable test user via the admin API (email/password,
 * pre-confirmed) and returns a client already signed in as that user.
 *
 * The app itself only supports Google OAuth (see docs/adr/0001), but the
 * test harness needs a way to obtain a real, RLS-subject session without a
 * browser — email/password via the admin API is that way. This never
 * touches the app's login flow.
 *
 * Desde a 0049 quem está no teste grátis está na Rede. Por padrão a conta
 * nasce com o teste já acabado, para que só o convite (semeado pelo teste)
 * diga quem está na Rede, antes e depois da 0049. `{ teste: "ativo" }`
 * deixa o teste correndo, como uma conta nova de verdade.
 */
export async function createTestUser(
  opcoes: { teste?: "ativo" | "acabou" } = {}
): Promise<TestUser> {
  const admin = adminClient();
  const email = `rede-test-${randomUUID()}@example.test`;
  const password = randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(
      `[tests/rede] Failed to create test user: ${error?.message}`
    );
  }

  try {
    if (opcoes.teste !== "ativo") {
      await acabarTesteGratis(data.user.id);
    }
    const client = await authenticatedClient(email, password);
    return { id: data.user.id, email, password, client };
  } catch (error) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw error;
  }
}

/** Põe o teste grátis da conta como acabado há 30 dias (service role). */
export async function acabarTesteGratis(userId: string): Promise<void> {
  const inicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { error } = await adminClient()
    .from("configuracoes")
    .update({
      trial_started_at: inicio.toISOString(),
      assinatura_status: "vencida",
    })
    .eq("user_id", userId);
  if (error) {
    throw new Error(
      `[tests/rede] Failed to end the free trial of ${userId}: ${error.message}`
    );
  }
}

/** Deletes a test user (and, via FK cascade, any rows owned by them). */
export async function deleteTestUser(user: TestUser): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    throw new Error(
      `[tests/rede] Failed to delete test user ${user.email}: ${error.message}`
    );
  }
}
