import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export type DevPreviewSessionResult =
  | { kind: "unavailable"; message: string }
  | { kind: "ok"; accessToken: string; userId: string };

// Fully fictitious, fixed on purpose — reused across dev-preview loads
// instead of minting a new disposable account every time, so a manual
// testing session doesn't pile up orphan users in the local Postgres.
const DEV_PREVIEW_TEST_EMAIL = "dev-preview-gate@example.test";

const NAO_CONFIGURADO =
  'Ambiente de teste local não configurado — rode "supabase start" e preencha .env.test.local (ver docs/rede/TEST_HARNESS.md).';
const INDISPONIVEL =
  "Serviço indisponível — não foi possível contatar o Supabase local de teste.";

/**
 * Provisions (or reuses) the one disposable local test account
 * /dev-preview/app signs in as, so the Gate's real endpoints
 * (solicitar-beta, convites) have a genuine Supabase Auth session to
 * validate against — never a hardcoded/faked result. Only ever talks to
 * SUPABASE_TEST_URL (the same local instance the RLS/concurrency test
 * harness in tests/rede/support/ uses), never the app's real
 * NEXT_PUBLIC_SUPABASE_URL.
 */
export async function ensureDevPreviewSession(): Promise<DevPreviewSessionResult> {
  const url = process.env.SUPABASE_TEST_URL;
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    return { kind: "unavailable", message: NAO_CONFIGURADO };
  }

  try {
    const admin = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const password = randomUUID();
    const userId = await findOrCreateTestUser(admin, password);

    const anon = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email: DEV_PREVIEW_TEST_EMAIL,
      password,
    });

    if (error || !data.session) {
      return { kind: "unavailable", message: INDISPONIVEL };
    }

    return { kind: "ok", accessToken: data.session.access_token, userId };
  } catch {
    return { kind: "unavailable", message: INDISPONIVEL };
  }
}

type AdminClient = ReturnType<typeof createClient<Database>>;

async function findOrCreateTestUser(
  admin: AdminClient,
  password: string
): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === DEV_PREVIEW_TEST_EMAIL);

  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEV_PREVIEW_TEST_EMAIL,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(
      `[dev-preview] failed to create local test user: ${error?.message}`
    );
  }
  return data.user.id;
}
