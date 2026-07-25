/**
 * Loads and validates the Supabase connection used by the Rede test harness.
 *
 * This file is the single guardrail against ever running these tests against
 * production. Every other helper in tests/rede/support goes through
 * getTestEnv() to get its connection details — nothing reads
 * process.env.SUPABASE_* directly.
 */

const PRODUCTION_HOST = "seciereacfestemdhzhp.supabase.co";

export type TestEnv = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[tests/rede] Missing required env var ${name}. Run "supabase start" and copy the ` +
        `printed API URL / anon key / service_role key into .env.test.local, or see ` +
        `docs/rede/TEST_HARNESS.md for staging setup.`
    );
  }
  return value;
}

function assertNotProduction(supabaseUrl: string): void {
  const host = new URL(supabaseUrl).hostname;

  if (host === PRODUCTION_HOST) {
    throw new Error(
      `[tests/rede] Refusing to run: SUPABASE_TEST_URL points at the production project ` +
        `(${PRODUCTION_HOST}). These tests create/delete users and must only run against a ` +
        `local Supabase (supabase start) or a dedicated staging project.`
    );
  }

  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal && process.env.SUPABASE_TEST_ALLOW_REMOTE !== "true") {
    throw new Error(
      `[tests/rede] SUPABASE_TEST_URL ("${supabaseUrl}") is not a local Supabase instance. ` +
        `If this is intentionally a dedicated staging project, set ` +
        `SUPABASE_TEST_ALLOW_REMOTE=true explicitly to confirm — this is a deliberate opt-in, ` +
        `never a default, so a stray env var can't silently point tests at a shared/remote DB.`
    );
  }
}

export function getTestEnv(): TestEnv {
  const supabaseUrl = requireEnv("SUPABASE_TEST_URL");
  const anonKey = requireEnv("SUPABASE_TEST_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_TEST_SERVICE_ROLE_KEY");

  assertNotProduction(supabaseUrl);

  return { supabaseUrl, anonKey, serviceRoleKey };
}
