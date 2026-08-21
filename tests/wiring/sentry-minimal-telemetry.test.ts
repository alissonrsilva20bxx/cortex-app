import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T19/#72 — a issue é explícita: "nenhuma telemetria de comportamento/
 * engajamento além do estritamente necessário para diagnosticar bugs" é
 * uma condição de bloqueio, não só uma preferência. Esses testes fixam
 * essa política nas três configs (client/server/edge) — um `git blame`
 * ou PR futuro que ligue tracing/replay sem querer quebra isso aqui em
 * vez de vazar telemetria silenciosamente. Mesmo padrão de inspeção de
 * código-fonte de pinsetup-save-error.test.ts (ambiente do vitest é
 * "node", sem DOM/Testing Library).
 */

const configs = [
  "sentry.client.config.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
] as const;

function readConfig(name: (typeof configs)[number]): string {
  return readFileSync(join(__dirname, "..", "..", name), "utf-8");
}

describe.each(configs)("%s — política mínima de telemetria", (name) => {
  const src = readConfig(name);

  it("desliga performance monitoring (tracesSampleRate: 0)", () => {
    expect(src).toMatch(/tracesSampleRate:\s*0\b/);
  });

  it("não coleta PII por padrão (sendDefaultPii: false)", () => {
    expect(src).toMatch(/sendDefaultPii:\s*false\b/);
  });

  it("não liga session replay nem tracing manual (chamada de verdade, não só o nome num comentário)", () => {
    expect(src).not.toMatch(/Sentry\.browserTracingIntegration\(/);
    expect(src).not.toMatch(/Sentry\.replayIntegration\(/);
  });

  it("lê o DSN só de env var, nunca hardcoded", () => {
    expect(src).toMatch(/dsn:\s*process\.env\.NEXT_PUBLIC_SENTRY_DSN/);
    expect(src).not.toMatch(/dsn:\s*["']https?:\/\//);
  });
});

describe("next.config.mjs — upload de sourcemap não exige SENTRY_AUTH_TOKEN local", () => {
  const src = readFileSync(
    join(__dirname, "..", "..", "next.config.mjs"),
    "utf-8"
  );

  it("desliga sourcemaps quando SENTRY_AUTH_TOKEN não está definido", () => {
    expect(src).toMatch(
      /disable:\s*!process\.env\.SENTRY_AUTH_TOKEN/
    );
  });

  it("nunca hardcoda um authToken", () => {
    expect(src).not.toMatch(/authToken:\s*["']/);
  });
});
