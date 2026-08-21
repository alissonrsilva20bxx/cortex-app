/**
 * T19/#72 — hook de registro do Next.js (App Router, estável desde 13.4),
 * carrega a config certa do Sentry por runtime. `sentry.client.config.ts`
 * é carregado à parte, pelo plugin de build do withSentryConfig.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
