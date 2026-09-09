import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
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
    setupFiles: ["tests/rede/support/vitest.setup.ts"],
    environment: "node",
    // These hit a real Postgres/Auth instance over HTTP (local or staging),
    // not mocks — default timeouts are too tight for that.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
});
