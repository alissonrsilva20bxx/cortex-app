import { config } from "dotenv";

// .env.test.local is gitignored (matches the repo's existing `.env*` rule) —
// each developer/CI job points it at their own local `supabase start` or a
// dedicated staging project. See docs/rede/TEST_HARNESS.md.
config({ path: ".env.test.local", quiet: true });
