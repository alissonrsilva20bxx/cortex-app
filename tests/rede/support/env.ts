/**
 * Loads and validates the Supabase connection used by the Rede test harness.
 *
 * This file is the single guardrail against ever running these tests against
 * production. Every other helper in tests/rede/support goes through
 * getTestEnv() to get its connection details — nothing reads
 * process.env.SUPABASE_* directly.
 */

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

function assertLocalSupabase(supabaseUrl: string): void {
  const host = new URL(supabaseUrl).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal) {
    throw new Error(
      `[tests/rede] SUPABASE_TEST_URL ("${supabaseUrl}") is not a local Supabase instance. ` +
        `These tests create and delete users with a service-role key, so this harness accepts ` +
        `only localhost or 127.0.0.1.`
    );
  }
}

export function getTestEnv(): TestEnv {
  const supabaseUrl = requireEnv("SUPABASE_TEST_URL");
  const anonKey = requireEnv("SUPABASE_TEST_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_TEST_SERVICE_ROLE_KEY");

  assertLocalSupabase(supabaseUrl);

  return { supabaseUrl, anonKey, serviceRoleKey };
}
