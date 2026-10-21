import { expect, it } from "vitest";

// Sem SUPABASE_TEST_URL o vitest.config.ts tira tests/rede/** da rodada.
// Este teste deixa isso visível como "skipped" em vez de sumir em silêncio.
const semBanco = !process.env.SUPABASE_TEST_URL;

const nome = semBanco
  ? "PULADO: tests/rede precisa de SUPABASE_TEST_URL (Supabase local). Use npm run teste-banco"
  : "tests/rede ativos: SUPABASE_TEST_URL definido";

it.skipIf(semBanco)(nome, () => {
  expect(process.env.SUPABASE_TEST_URL).toBeTruthy();
});
