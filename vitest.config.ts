import { defineConfig } from "vitest/config";

export default defineConfig({
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
