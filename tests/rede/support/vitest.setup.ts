import { config } from "dotenv";

// .env.test.local is gitignored (matches the repo's existing `.env*` rule) —
// each developer/CI job points it at its own local `supabase start`.
// Remote hosts are rejected by tests/rede/support/env.ts.
config({ path: ".env.test.local", quiet: true });
