import { config as carregarEnv } from "dotenv";
import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

// Mesmo arquivo que tests/rede/support/vitest.setup.ts carrega: precisa estar
// no process.env já na hora de decidir se tests/rede entra ou não.
carregarEnv({ path: ".env.test.local", quiet: true });

// Sem Supabase local de teste, só os testes que usam banco ficam de fora (e
// tests/banco-pulado.test.ts mostra o PULADO). Os testes puros de tests/rede
// (serviços e rotas com vi.mock) continuam no pre-teste. Com banco, tudo roda.
// Arquivo novo que importe tests/rede/support/env|clients|testUsers de verdade
// precisa entrar nesta lista.
const testesDeBanco = [
  "tests/rede/rls/**",
  "tests/rede/concurrency/**",
  "**/*.integration.test.ts",
  "tests/desejo/desejo.fluxo.test.ts",
];
const temBanco = Boolean(process.env.SUPABASE_TEST_URL);

export default defineConfig({
  // tsconfig usa jsx "preserve" (o Next compila); no vitest o oxc precisa
  // transformar o JSX para os testes que renderizam componentes.
  oxc: { jsx: { runtime: "automatic" } },
  // Espelha tsconfig.json `compilerOptions.paths` -- sem isso, importar um
  // arquivo que usa "@/lib/..."/"@/components/..." direto num teste
  // (ex.: app/api/cron/*/route.ts) falha a resolver o módulo. Só os dois
  // prefixos que o tsconfig de fato declara, não um "@/*" genérico.
  resolve: {
    alias: [
      {
        find: "@/components",
        replacement: path.resolve(__dirname, "components"),
      },
      { find: "@/lib", replacement: path.resolve(__dirname, "lib") },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: temBanco ? configDefaults.exclude : [...configDefaults.exclude, ...testesDeBanco],
    setupFiles: ["tests/rede/support/vitest.setup.ts"],
    environment: "node",
    // These hit a real Postgres/Auth instance over HTTP (local or staging),
    // not mocks — default timeouts are too tight for that.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
});
