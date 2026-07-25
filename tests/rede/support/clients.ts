import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../lib/database.types";
import { getTestEnv } from "./env";

export type TestClient = SupabaseClient<Database>;

/**
 * Service-role client — bypasses RLS. Only for test setup/teardown
 * (creating/deleting test users, seeding fixtures), never for making the
 * assertions themselves.
 */
export function adminClient(): TestClient {
  const { supabaseUrl, serviceRoleKey } = getTestEnv();
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Anon client with no session — for testing unauthenticated access. */
export function anonClient(): TestClient {
  const { supabaseUrl, anonKey } = getTestEnv();
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * A client signed in as a given test user's email/password, subject to RLS
 * exactly like a real browser session would be.
 */
export async function authenticatedClient(
  email: string,
  password: string
): Promise<TestClient> {
  const { supabaseUrl, anonKey } = getTestEnv();
  const client = createClient<Database>(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      `[tests/rede] Failed to sign in as ${email}: ${error.message}`
    );
  }

  return client;
}
