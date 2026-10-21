// npm run teste-banco: roda só tests/rede e exige o Supabase local de teste.
import { config } from "dotenv";
import { spawnSync } from "node:child_process";

config({ path: ".env.test.local", quiet: true });

if (!process.env.SUPABASE_TEST_URL) {
  console.error(
    "teste-banco: falta SUPABASE_TEST_URL. Suba o Supabase local (npm run supabase:start) " +
      "e copie URL e chaves para .env.test.local (veja docs/rede/TEST_HARNESS.md)."
  );
  process.exit(1);
}

const r = spawnSync("npx", ["vitest", "run", "tests/rede", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
});
process.exit(r.status ?? 1);
